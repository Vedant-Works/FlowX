export const ROUTE_COLORS = [
  { main: '#0066ff', bg: 'rgba(0, 102, 255, 0.18)', name: 'Electric Blue' },
  { main: '#ff5500', bg: 'rgba(255, 85, 0, 0.18)', name: 'Hot Orange' },
  { main: '#e600ac', bg: 'rgba(230, 0, 172, 0.18)', name: 'Magenta' },
  { main: '#00cc44', bg: 'rgba(0, 204, 68, 0.18)', name: 'Neon Green' },
  { main: '#9900ff', bg: 'rgba(153, 0, 255, 0.18)', name: 'Electric Violet' },
]

export function getRouteColor(index) {
  return ROUTE_COLORS[index % ROUTE_COLORS.length]
}
