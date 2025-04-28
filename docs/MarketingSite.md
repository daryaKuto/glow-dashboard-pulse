
# Marketing Site Documentation

## Overview

The marketing site serves as the public-facing portion of the FunGun Training application. It introduces visitors to the product offerings, provides information about the affiliate program, and handles user authentication.

## Key Pages

### Home Page (`/`)
- **Purpose**: Main landing page showcasing the FunGun training system
- **Components**:
  - Hero Section: Introduces the product with a call to action
  - Why Section: Highlights key benefits of the training system
  - Affiliate Section: Promotes the affiliate program

### Products Page (`/products`)
- **Purpose**: Displays available product offerings
- **Components**:
  - Product Cards: Shows different kit options (Starter, Pro, Team)
  - Pre-order/Contact buttons: Links to relevant actions

### Affiliate Application Page (`/affiliate/apply`)
- **Purpose**: Allows users to apply for the affiliate program
- **Components**:
  - Application Form: Collects applicant information
  - Submission Handler: Processes applications

## Authentication

The marketing site includes authentication pages that serve as entry points to the dashboard:

### Login Page (`/login`)
- Authenticates existing users
- Redirects to dashboard upon successful login

### Signup Page (`/signup`)
- Registers new users
- Redirects to dashboard upon successful registration

## Navigation

The Navbar component (`src/components/marketing/Navbar.tsx`) handles navigation and displays:
- Always visible: Home, Products, Apply as Affiliate
- For non-authenticated users: Login, Sign Up
- For authenticated users: Dashboard link

## Styling

- **Color Scheme**: Uses brand colors defined in Tailwind configuration
  - Primary: brand-indigo (background)
  - Accent: brand-lavender (buttons, accents)
  - Surface: brand-surface (card backgrounds)
- **Components**: Leverages shadcn/ui components for consistent UI
- **Responsive Design**: Mobile-first approach with responsive layouts

## Footer

The footer contains:
- Links to key pages
- Copyright information
- Social media links (placeholder)
