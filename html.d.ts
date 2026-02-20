// Type declaration so TypeScript recognizes require('./voiceorb.html')
declare module '*.html' {
  const value: string
  export default value
}