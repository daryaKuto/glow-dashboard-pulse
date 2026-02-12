import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				// Shadcn/UI semantic colors using CSS variables
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))', // #CE3E0A - Active/hover state
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))', // #816E94 - Muted/inactive states, labels, borders
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))', // #CE3E0A - burnt orange (primary accent)
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Brand colors - exact hex values for systematic use
				brand: {
					// Core brand colors (your specified palette)
					dark: '#1C192B',        // Fonts and dark background/accents
					primary: '#CE3E0A',     // Icons, buttons when hovered/activated, current page highlights
					secondary: '#816E94',   // Muted/inactive states, labels, subtle borders
					light: '#F6F7EB',       // Background for every page
					surface: '#FFFFFF',     // Light card background
					
					// Semantic aliases for clarity
					text: '#1C192B',
					accent: '#CE3E0A',
					neutral: '#816E94',
					background: '#F6F7EB',
					
					// Legacy colors for backward compatibility
					black: '#1C192B',
					'burnt-orange': '#CE3E0A',
					purple: '#816E94',
					ivory: '#F6F7EB',
					brown: '#6B4A38',
					indigo: '#0A002B',
					lavender: '#A884FF',
					orange: '#FF7A00',
					error: '#FF3B5C',
					success: '#00D97E',
					'fg-secondary': '#B7B9D6',
				},
			},
			fontFamily: {
				// Brand typography
				display: ['Comfortaa', 'sans-serif'],     // Logo/display only
				heading: ['Merriweather', 'serif'],       // Headings & UI labels  
				body: ['Raleway', 'sans-serif'],          // Body text
				
				// Legacy aliases
				sans: ['Raleway', 'sans-serif'],
			},
			fontSize: {
				// Typography scale matching the brand tokens
				'display': ['2.5rem', { lineHeight: '1.2', fontWeight: '600' }],
				'h1': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '600' }],
				'h1-md': ['2.25rem', { lineHeight: '2.5rem', fontWeight: '600' }],
				'h2': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
				'h2-md': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '600' }],
				'h3': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
				'overline': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: '500' }],
				// Strava-style stat display sizes
				'stat-hero': ['3rem', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.02em' }],
				'stat-lg': ['2.25rem', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.02em' }],
				'stat-md': ['1.75rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.01em' }],
				'stat-sm': ['1.25rem', { lineHeight: '1.2', fontWeight: '600' }],
				'label': ['0.6875rem', { lineHeight: '1rem', fontWeight: '500', letterSpacing: '0.06em' }],
			},
			backgroundImage: {
				'iridescent': 'linear-gradient(90deg,#00E6FF 0%,#3C6CFF 30%,#B13CFF 60%,#FF7A00 100%)',
			},
			borderRadius: {
				DEFAULT: 'var(--radius)',
				lg: 'var(--radius)',
				'radius-lg': 'var(--radius-lg)',
				full: 'var(--radius-full)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				'2xl': '1.25rem',
			},
			boxShadow: {
				'card': 'var(--shadow-md)',
				'card-hover': 'var(--shadow-hover)',
				'subtle': 'var(--shadow-sm)',
				'elevated': 'var(--shadow-lg)',
			},
			letterSpacing: {
				'wide': '0.05em',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'hit-flash': {
					'0%': { color: '#A884FF' },
					'50%': { color: '#FF7A00' },
					'100%': { color: '#A884FF' },
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'hit-flash': 'hit-flash 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;