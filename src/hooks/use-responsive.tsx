import * as React from "react"

const MOBILE_BREAKPOINT = 768
const DESKTOP_BREAKPOINT = 1024
const IPHONE_14_MAX_WIDTH = 430

/**
 * Hook for responsive breakpoint detection
 * Returns isMobile, isTablet, and isDesktop based on screen size
 * - Mobile: < 768px (includes iPhone 14 Max at 430px)
 * - Tablet: 768px - 1023px  
 * - Desktop: >= 1024px
 * 
 * Also provides isSmallMobile for iPhone 14 Max (430px) specific optimizations
 */
export function useResponsive() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)
  const [isTablet, setIsTablet] = React.useState<boolean>(false)
  const [isDesktop, setIsDesktop] = React.useState<boolean>(false)
  const [isSmallMobile, setIsSmallMobile] = React.useState<boolean>(false)
  const [isLandscape, setIsLandscape] = React.useState<boolean>(false)

  React.useEffect(() => {
    const updateBreakpoints = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      setIsMobile(width < MOBILE_BREAKPOINT)
      setIsTablet(width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT)
      setIsDesktop(width >= DESKTOP_BREAKPOINT)
      
      // iPhone 14 Max and similar small mobile screens
      setIsSmallMobile(width <= IPHONE_14_MAX_WIDTH)
      
      // Orientation detection
      setIsLandscape(width > height)
    }

    // Initial check
    updateBreakpoints()

    // Listen for resize and orientation change events
    const mobileMql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const tabletMql = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${DESKTOP_BREAKPOINT - 1}px)`)
    const desktopMql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`)
    const smallMobileMql = window.matchMedia(`(max-width: ${IPHONE_14_MAX_WIDTH}px)`)
    const landscapeMql = window.matchMedia(`(orientation: landscape)`)

    const handleChange = () => updateBreakpoints()

    // Add all event listeners
    mobileMql.addEventListener("change", handleChange)
    tabletMql.addEventListener("change", handleChange)
    desktopMql.addEventListener("change", handleChange)
    smallMobileMql.addEventListener("change", handleChange)
    landscapeMql.addEventListener("change", handleChange)
    window.addEventListener("resize", handleChange)
    window.addEventListener("orientationchange", () => {
      // Delay update after orientation change to get accurate dimensions
      setTimeout(updateBreakpoints, 100)
    })

    return () => {
      mobileMql.removeEventListener("change", handleChange)
      tabletMql.removeEventListener("change", handleChange)
      desktopMql.removeEventListener("change", handleChange)
      smallMobileMql.removeEventListener("change", handleChange)
      landscapeMql.removeEventListener("change", handleChange)
      window.removeEventListener("resize", handleChange)
      window.removeEventListener("orientationchange", updateBreakpoints)
    }
  }, [])

  return { 
    isMobile, 
    isTablet, 
    isDesktop, 
    isSmallMobile, 
    isLandscape,
    // Convenience computed properties
    isTabletOrMobile: isMobile || isTablet,
    isNarrowScreen: isSmallMobile
  }
}
