# ailith.co Design System

Complete brand tokens and typography showcase for the Glow Dashboard Pulse application.

## Brand Colors

### Core Brand Palette

- **Brand Dark**: `#1C192B` - Fonts and dark background/accents
- **Brand Primary**: `#CE3E0A` - Icons, buttons when hovered/activated, current page highlights  
- **Brand Secondary**: `#816E94` - Search bar background, buttons when not hovered/activated
- **Brand Light**: `#F6F7EB` - Background for every page
- **Brand Surface**: `#FFFFFF` - Light card background

### Semantic Usage

- **Text**: `#1C192B` (brand-dark)
- **Accent**: `#CE3E0A` (brand-primary) 
- **Neutral**: `#816E94` (brand-secondary)
- **Background**: `#F6F7EB` (brand-light)

### Legacy Colors (Backward Compatibility)

- **Black**: `#1C192B`
- **Burnt Orange**: `#CE3E0A`
- **Purple**: `#816E94`
- **Ivory**: `#F6F7EB`
- **Brown**: `#6B4A38`

## Typography

### Font Families

- **Display Font**: `Comfortaa` - Logo and display text only
- **Heading Font**: `Merriweather` - Headings and UI labels
- **Body Font**: `Raleway` - Body text and general UI

### Typography Scale

- **Display**: 2.5rem, line-height 1.2, font-weight 600
- **H1**: 1.875rem (2.25rem on md+), line-height 2.25rem (2.5rem on md+), font-weight 600
- **H2**: 1.5rem (1.875rem on md+), line-height 2rem (2.25rem on md+), font-weight 600  
- **H3**: 1.25rem, line-height 1.75rem, font-weight 600
- **Body**: 1rem, line-height 1.5rem, font-weight 400
- **Caption**: 0.875rem, line-height 1.25rem, font-weight 400
- **Overline**: 0.75rem, line-height 1rem, font-weight 500, uppercase, letter-spacing 0.1em

## Usage Examples

### Headings
```html
<h1 class="font-heading text-h1 md:text-h1-md">Main Page Title</h1>
<h2 class="font-heading text-h2 md:text-h2-md">Section Heading</h2>
<h3 class="font-heading text-h3">Subsection Heading</h3>
```

### Body Text
```html
<p class="font-body">This is body text using Raleway for optimal readability.</p>
```

### Display/Logo Text
```html
<p class="font-display text-2xl font-semibold">ailith.co Dashboard</p>
```

### Labels and Navigation
```html
<p class="overline">Navigation • Settings • Profile</p>
```

## Component Examples

### Buttons
- **Primary**: `bg-brand-primary hover:bg-brand-primary/90 text-white`
- **Secondary**: `bg-brand-secondary hover:bg-brand-secondary/90 text-white`
- **Outline**: `border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white`

### Cards
- **Default**: `bg-white border-gray-200 shadow-sm`
- **On Brand Background**: `bg-brand-surface border-gray-200`

### Status Indicators
- **Online**: `bg-green-100 text-green-700 border-green-200`
- **Offline**: `bg-gray-100 text-gray-600 border-gray-200`
- **Active**: `bg-red-50 text-red-700 border-red-200`
- **Warning**: `bg-yellow-50 text-yellow-700 border-yellow-200`

## Implementation Notes

### Tailwind Configuration
All brand tokens are configured in `tailwind.config.ts` under the `brand` color palette and custom font families.

### CSS Variables
Core brand colors are also available as CSS custom properties for dynamic theming if needed.

### Accessibility
- All color combinations meet WCAG AA contrast requirements
- Font sizes follow a consistent scale for better readability
- Interactive elements have proper hover and focus states

### Responsive Design
- Typography scales appropriately on different screen sizes
- Mobile-first approach with `md:` breakpoint adjustments
- Consistent spacing using Tailwind's spacing scale

---

**Last Updated**: January 18, 2025  
**Version**: 1.0
