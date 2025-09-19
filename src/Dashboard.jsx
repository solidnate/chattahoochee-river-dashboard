import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './Dashboard.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

// Utility functions
const celsiusToFahrenheit = (celsius) => (celsius * 9/5) + 32
const formatSiteName = (siteName) => siteName.replace('CHATTAHOOCHEE RIVER', 'Chattahoochee R.')
const formatTemperature = (tempC) => {
  const tempF = celsiusToFahrenheit(tempC)
  return `${tempC}°C / ${tempF.toFixed(1)}°F`
}

const Dashboard = () => {
  const [data, setData] = useState({ sites: [], ecoli: {} })
  const [loading, setLoading] = useState(false)
  const [loadingStates, setLoadingStates] = useState({
    sites: true,
    weather: true,
    ecoli: true
  })
  const [errors, setErrors] = useState({
    sites: null,
    weather: null,
    ecoli: null
  })

  // All hooks must be at the top level
  const scrollToSite = useCallback((siteId) => {
    const element = document.getElementById(`site-${siteId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const retryData = useCallback(async (type) => {
    if (type === 'weather') {
      setLoadingStates(prev => ({ ...prev, weather: true }))
      setErrors(prev => ({ ...prev, weather: null }))
      
      try {
        const weatherLat = 34.001056
        const weatherLon = -84.367000
        const weatherResponse = await fetch(`https://api.weather.gov/points/${weatherLat},${weatherLon}`)
        let forecastData = []
        
        if (weatherResponse.ok) {
          const weatherPoints = await weatherResponse.json()
          if (weatherPoints.properties?.forecast) {
            const forecastResponse = await fetch(weatherPoints.properties.forecast)
            if (forecastResponse.ok) {
              const forecast = await forecastResponse.json()
              forecastData = forecast.properties?.periods?.slice(0, 14) || []
            }
          }
        }
        
        setData(prev => ({ ...prev, forecast: forecastData }))
        setLoadingStates(prev => ({ ...prev, weather: false }))
        setErrors(prev => ({ ...prev, weather: forecastData.length === 0 ? 'Weather forecast temporarily unavailable' : null }))
      } catch (error) {
        setLoadingStates(prev => ({ ...prev, weather: false }))
        setErrors(prev => ({ ...prev, weather: 'Unable to load weather forecast' }))
      }
    } else {
      // For sites and ecoli, reload for now (more complex to extract)
      window.location.reload()
    }
  }, [])

  // Handle legacy data structure or ensure sites is an array
  const sites = Array.isArray(data) ? data : (data.sites || [])
  const ecoliData = data.ecoli || {}
  const forecastData = data.forecast || []

  // Memoized calculations for performance
  const processedSiteData = useMemo(() => {
    return sites.map(site => {
      const values = site.temperatureData?.values?.[0]?.value
      if (!values || values.length === 0) {
        return { ...site, latestTemp: null, dailyPeaks: {} }
      }

      // Calculate daily peaks
      const dailyPeaks = {}
      values.forEach(v => {
        const date = new Date(v.dateTime).toDateString()
        const tempC = parseFloat(v.value)
        if (!dailyPeaks[date] || tempC > dailyPeaks[date].tempC) {
          dailyPeaks[date] = {
            tempC: tempC,
            tempF: celsiusToFahrenheit(tempC),
            time: new Date(v.dateTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
          }
        }
      })

      // Get latest temperature
      const latest = values[values.length - 1]
      const latestTemp = {
        celsius: parseFloat(latest.value),
        fahrenheit: celsiusToFahrenheit(parseFloat(latest.value)),
        timestamp: new Date(latest.dateTime).toLocaleString([], {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      }

      return { ...site, latestTemp, dailyPeaks, temperatureValues: values }
    })
  }, [sites])

  useEffect(() => {
    let isCancelled = false
    
    const updateLoadingState = (key, value) => {
      if (!isCancelled) {
        setLoadingStates(prev => ({ ...prev, [key]: value }))
      }
    }
    
    const updateError = (key, error) => {
      if (!isCancelled) {
        setErrors(prev => ({ ...prev, [key]: error }))
      }
    }
    
    const fetchDashboardData = async () => {
      try {
        // Your requested USGS monitoring sites near Roswell, GA
        const siteIds = ['02335450', '02335778', '02335777', '02335779'] // Chattahoochee River sites near Roswell
        
        // Your requested weather coordinates
        const weatherLat = 34.001056
        const weatherLon = -84.367000
        
        // E.coli monitoring sites from Georgia BacteriALERT program
        const ecoliSites = ['02335000', '02335880', '02336000'] // Norcross, Powers Ferry, Paces Ferry
        
        const siteDataPromises = siteIds.map(async (siteId) => {
          try {
            // Fetch USGS water temperature data for last 7 days
            const sevenDaysAgo = new Date()
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
            const startDate = sevenDaysAgo.toISOString().split('T')[0]
            
            const waterResponse = await fetch(
              `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteId}&parameterCd=00010&startDT=${startDate}&siteStatus=active`
            )
            if (!waterResponse.ok) {
              console.warn(`Water data unavailable for site ${siteId}`)
              return null
            }
            const waterData = await waterResponse.json()
            
            // Extract site info
            const siteInfo = waterData.value.timeSeries[0]?.sourceInfo
            if (!siteInfo) return null
            
            const lat = parseFloat(siteInfo.geoLocation.geogLocation.latitude)
            const lon = parseFloat(siteInfo.geoLocation.geogLocation.longitude)
            
                // This will be handled globally after all sites
            
            return {
              siteId: siteId,
              siteName: siteInfo.siteName,
              location: { lat: lat, lon: lon },
              temperatureData: waterData.value.timeSeries[0] || { values: [{ value: [] }] }
            }
          } catch (error) {
            console.warn(`Failed to fetch data for site ${siteId}:`, error.message)
            return null
          }
        })
        
        const siteResults = await Promise.allSettled(siteDataPromises)
        const validSites = siteResults
          .filter(result => result.status === 'fulfilled' && result.value !== null)
          .map(result => result.value)
        
        if (!isCancelled) {
          updateLoadingState('sites', false)
          if (validSites.length === 0) {
            updateError('sites', 'Unable to load water monitoring data. Please try again later.')
          } else {
            updateError('sites', null)
          }
        }

        // Fetch 7-day weather forecast for the specified location
        let forecastData = []
        try {
          const weatherResponse = await fetch(`https://api.weather.gov/points/${weatherLat},${weatherLon}`)
          if (weatherResponse.ok) {
            const weatherPoints = await weatherResponse.json()
            
            if (weatherPoints.properties?.forecast) {
              const forecastResponse = await fetch(weatherPoints.properties.forecast)
              if (forecastResponse.ok) {
                const forecast = await forecastResponse.json()
                forecastData = forecast.properties?.periods?.slice(0, 14) || [] // 7 days = 14 periods (day/night)
              }
            }
          }
          if (!isCancelled) {
            updateLoadingState('weather', false)
            updateError('weather', forecastData.length === 0 ? 'Weather forecast temporarily unavailable' : null)
          }
        } catch (weatherError) {
          console.warn('7-day weather forecast unavailable:', weatherError.message)
          if (!isCancelled) {
            updateLoadingState('weather', false)
            updateError('weather', 'Unable to load weather forecast')
          }
        }

        // Fetch E.coli data from BacteriALERT sites
        let ecoliData = {}
        try {
          const ecoliResponse = await fetch(
            `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${ecoliSites.join(',')}&parameterCd=99407&siteStatus=active`
          )
          if (ecoliResponse.ok) {
            const ecoliJson = await ecoliResponse.json()
            // Process E.coli data by site
            ecoliJson.value.timeSeries?.forEach(series => {
              const siteCode = series.sourceInfo.siteCode[0].value
              const values = series.values[0]?.value
              if (values && values.length > 0) {
                const latest = values[values.length - 1]
                const riskLevel = parseFloat(latest.value) > 235 ? 'High Risk' : 'Low Risk'
                ecoliData[siteCode] = {
                  value: latest.value,
                  dateTime: latest.dateTime,
                  siteName: series.sourceInfo.siteName,
                  riskLevel: riskLevel
                }
              }
            })
          }
          if (!isCancelled) {
            updateLoadingState('ecoli', false)
            updateError('ecoli', Object.keys(ecoliData).length === 0 ? 'E.coli data temporarily unavailable' : null)
          }
        } catch (ecoliError) {
          console.warn('E.coli data unavailable:', ecoliError.message)
          if (!isCancelled) {
            updateLoadingState('ecoli', false)
            updateError('ecoli', 'Unable to load E.coli safety data')
          }
        }
        
        if (!isCancelled) {
          setData({ sites: validSites, ecoli: ecoliData, forecast: forecastData })
        }
      } catch (error) {
        console.error('Failed to fetch real data:', error)
        if (!isCancelled) {
          // Set error states for all components
          setErrors({
            sites: 'Unable to load monitoring data',
            weather: 'Unable to load weather forecast', 
            ecoli: 'Unable to load E.coli data'
          })
          setLoadingStates({
            sites: false,
            weather: false,
            ecoli: false
          })
          // Fallback to minimal mock data if APIs fail
          setData({
            sites: [{
              siteId: 'error',
              siteName: 'Data temporarily unavailable',
              location: { lat: 34.001056, lon: -84.367000 },
              temperatureData: { values: [{ value: [] }] }
            }],
            ecoli: {},
            forecast: []
          })
        }
      }
    }
    
    fetchDashboardData()
    
    // Cleanup function to prevent setState on unmounted component
    return () => {
      isCancelled = true
    }
  }, [])

  // Removed global loading gate - now shows individual component loading states

  return (
    <div className="dashboard-container">
      <h1>Chattahoochee River Monitoring Dashboard</h1>

      {/* Summary Section */}
      <div className="summary-section">
        <div className="summary-grid">
          <div className="weather-summary">
            <h3>Current Weather</h3>
            {loadingStates.weather ? (
              <div className="loading-spinner">Loading weather...</div>
            ) : errors.weather ? (
              <div className="error-message">
                <div className="current-temp">--°</div>
                <div className="error-text">{errors.weather}</div>
                <button onClick={() => retryData('weather')} className="retry-button">Retry</button>
              </div>
            ) : forecastData.length > 0 ? (
              <>
                <div className="current-temp">{forecastData[0].temperature}°{forecastData[0].temperatureUnit}</div>
                <div className="weather-desc">{forecastData[0].shortForecast}</div>
                <div className="wind-info">Wind: {forecastData[0].windSpeed} {forecastData[0].windDirection}</div>
              </>
            ) : (
              <div className="current-temp">--°</div>
            )}
          </div>
          
          <div className="water-temps-summary">
            <h3>Current Water Temperatures</h3>
            {loadingStates.sites ? (
              <div className="loading-spinner">Loading water data...</div>
            ) : errors.sites ? (
              <div className="error-message">
                <div className="error-text">{errors.sites}</div>
                <button onClick={() => retryData('sites')} className="retry-button">Retry</button>
              </div>
            ) : (
              <div className="temp-grid">
                {processedSiteData.map(site => (
                  <div key={site.siteId} className="temp-item">
                    <div className="site-name">{formatSiteName(site.siteName)}</div>
                    <div className="temp-value">
                      {site.latestTemp ? formatTemperature(site.latestTemp.celsius) : 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* E.coli Safety Information */}
      <div className="ecoli-section">
        <h2>🦠 E.coli Water Safety - BacteriALERT Program</h2>
        {loadingStates.ecoli ? (
          <div className="loading-spinner">Loading E.coli data...</div>
        ) : errors.ecoli ? (
          <div className="error-message">
            <div className="error-text">{errors.ecoli}</div>
            <button onClick={() => retryData('ecoli')} className="retry-button">Retry</button>
          </div>
        ) : Object.keys(ecoliData).length > 0 ? (
          <div className="ecoli-grid">
            {Object.entries(ecoliData).map(([siteCode, ecoliInfo]) => (
              <div key={siteCode} className={`ecoli-card ${ecoliInfo.riskLevel.toLowerCase().replace(' ', '-')}`}>
                <h3>{formatSiteName(ecoliInfo.siteName)}</h3>
                <p className="ecoli-value">{ecoliInfo.value} CFU/100mL</p>
                <p className="risk-level">{ecoliInfo.riskLevel}</p>
                <p className="timestamp">{new Date(ecoliInfo.dateTime).toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="info-message">E.coli monitoring data not currently available</div>
        )}
      </div>

      {/* 7-Day Weather Forecast */}
      {forecastData.length > 0 && (
        <div className="forecast-section">
          <h2>🌤️ 7-Day Weather Forecast</h2>
          <div className="forecast-grid">
            {forecastData.map((period, index) => (
              <div key={index} className="forecast-card">
                <h4>{period.name}</h4>
                <p className="forecast-temp">{period.temperature}°{period.temperatureUnit}</p>
                <p className="forecast-desc">{period.shortForecast}</p>
                <p className="wind-info">Wind: {period.windSpeed} {period.windDirection}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="map-container">
        <MapContainer center={[34.001056, -84.367000]} zoom={14} style={{ width: '100%' }}>
          <TileLayer 
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {processedSiteData.map(site => (
            <Marker 
              key={site.siteId} 
              position={[site.location.lat, site.location.lon]}
              eventHandlers={{
                click: () => scrollToSite(site.siteId)
              }}
            >
              <Popup>
                <div>
                  <strong>{formatSiteName(site.siteName)}</strong>
                  <br />
                  <small>Click marker to view chart</small>
                  {site.latestTemp && (
                    <div>
                      <small>Latest: {formatTemperature(site.latestTemp.celsius)}</small>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {processedSiteData.map(site => (
        <div key={site.siteId} id={`site-${site.siteId}`} className="site-card">
          <h2>{formatSiteName(site.siteName)}</h2>
          <p>Latest Water Temperature: {
            site.latestTemp 
              ? `${formatTemperature(site.latestTemp.celsius)} (${site.latestTemp.timestamp})`
              : 'N/A'
          }</p>

          <div className="chart-container">
            <h3>Water Temperature Over Time</h3>
            {site.temperatureValues?.length > 0 ? (
              (() => {
                const last7DaysValues = site.temperatureValues
                const dailyPeaks = site.dailyPeaks

                return (
                  <Line data={{
                    labels: last7DaysValues.map(v => 
                      new Date(v.dateTime).toLocaleDateString([], {month: 'short', day: 'numeric', hour: '2-digit'})
                    ),
                    datasets: [
                      {
                        label: 'Temperature (°C)',
                        data: last7DaysValues.map(v => parseFloat(v.value)),
                        borderColor: 'rgb(220, 38, 127)',
                        backgroundColor: 'rgba(220, 38, 127, 0.1)',
                        tension: 0.1,
                        yAxisID: 'y'
                      },
                      {
                        label: 'Temperature (°F)',
                        data: last7DaysValues.map(v => celsiusToFahrenheit(parseFloat(v.value))),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1,
                        yAxisID: 'y1'
                      }
                    ]
                  }} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        labels: {
                          color: '#f8fafc'
                        }
                      },
                      tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: '#475569',
                        borderWidth: 1,
                        callbacks: {
                          afterBody: function(tooltipItems) {
                            if (tooltipItems.length > 0) {
                              const dataIndex = tooltipItems[0].dataIndex
                              const currentDateTime = last7DaysValues[dataIndex].dateTime
                              const currentDate = new Date(currentDateTime).toDateString()
                              
                              if (dailyPeaks[currentDate]) {
                                const peak = dailyPeaks[currentDate]
                                return [
                                  '',
                                  `Daily Peak: ${peak.tempC.toFixed(1)}°C / ${peak.tempF.toFixed(1)}°F`,
                                  `Peak Time: ${peak.time}`
                                ]
                              }
                            }
                            return []
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                          display: true,
                          text: 'Temperature (°C)',
                          color: '#f8fafc'
                        },
                        ticks: {
                          color: '#cbd5e1'
                        },
                        grid: {
                          color: '#475569'
                        }
                      },
                      y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                          display: true,
                          text: 'Temperature (°F)',
                          color: '#f8fafc'
                        },
                        ticks: {
                          color: '#cbd5e1'
                        },
                        grid: {
                          drawOnChartArea: false,
                          color: '#475569'
                        }
                      },
                      x: {
                        title: {
                          display: true,
                          text: `Last 7 Days (${last7DaysValues.length} readings)`,
                          color: '#f8fafc'
                        },
                        ticks: {
                          color: '#cbd5e1'
                        },
                        grid: {
                          color: '#475569'
                        }
                      }
                    }
                  }} />
                )
              })()
            ) : (
              <p>No temperature data available</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Dashboard