/**
 * Helper utility to export a FlowX route as a standard GPX file.
 */
export function exportRouteToGpx(route, sourceName = 'Origin', destinationName = 'Destination') {
  if (!route || !route.path || !route.path.length) return

  const trackPoints = route.path
    .map(
      ([lat, lon]) =>
        `      <trkpt lat="${lat}" lon="${lon}"></trkpt>`
    )
    .join('\n')

  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FlowX - Intelligent Urban Mobility" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>FlowX Route: ${sourceName} to ${destinationName}</name>
    <desc>Calculated using FlowX Intelligent Mobility Engine. Distance: ${(route.distance / 1000).toFixed(2)} km, Score: ${route.score}/100.</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${route.label} (${sourceName} -> ${destinationName})</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`

  const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `FlowX_Route_${route.rank}_${sourceName.split(',')[0].replace(/\s+/g, '_')}.gpx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
