# Chattahoochee River Monitoring Dashboard

A real-time environmental monitoring dashboard for the Chattahoochee River near Roswell, GA. Displays water temperature trends, weather forecasts, and E.coli safety information from USGS and National Weather Service APIs.

## Features

- **Real-time Water Temperature**: 7-day historical data from 4 USGS monitoring sites
- **Weather Forecast**: Current conditions and 7-day weather outlook
- **E.coli Monitoring**: Water safety information from Georgia BacteriALERT program
- **Interactive Map**: Click markers to navigate to site data
- **Dark Mode Design**: Professional, easy-to-read interface
- **Mobile Responsive**: Optimized for all device sizes

## Monitoring Sites

- **02335450**: Chattahoochee River near Roswell
- **02335778**: Chattahoochee River at Powers Ferry
- **02335777**: Chattahoochee River at Paces Ferry
- **02335779**: Chattahoochee River at Atlanta

## Technology Stack

- React 19 with Vite
- Chart.js for data visualization
- Leaflet for interactive maps
- Real-time data from USGS and National Weather Service APIs

## GitHub Pages Deployment

### Prerequisites
- GitHub account
- Git installed on your local machine

### Automated Deployment with GitHub Actions

This project includes a GitHub Actions workflow that automatically deploys to GitHub Pages when you push to the main branch.

1. **Create a new repository on GitHub**
   - Name it `chattahoochee-river-dashboard` (or your preferred name)
   - Make it public
   - Don't initialize with README (we already have this project)

2. **Update the base path in Vite config** (if your repo name is different)
   - Edit `vite.config.js` and update the base path to match your repository name:
   ```javascript
   base: '/your-repo-name/'
   ```

3. **Push to GitHub**
   ```bash
   # Clone/download this project to your local machine
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/chattahoochee-river-dashboard.git
   git push -u origin main
   ```

4. **Configure GitHub Pages**
   - Go to your repository on GitHub
   - Navigate to Settings > Pages
   - Set source to "GitHub Actions"
   - The workflow will automatically run and deploy your site

Your dashboard will be available at: `https://YOUR_USERNAME.github.io/chattahoochee-river-dashboard`

### Manual Deployment (Alternative)

If you prefer manual deployment, you can also use:
```bash
npm run deploy
```

This uses the `gh-pages` package to deploy to the `gh-pages` branch.

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Data Sources

- **USGS Water Services**: Real-time water data
- **National Weather Service**: Weather forecasts and current conditions
- **Georgia EPD BacteriALERT**: E.coli monitoring data

## License

ISC License