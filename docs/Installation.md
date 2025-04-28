
# Installation & Setup Guide

## Prerequisites

- Node.js (v18.0.0 or higher recommended)
- npm, yarn, or bun package manager

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
bun install
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
# or
bun dev
```

This will start the development server at `http://localhost:5173` (or another port if 5173 is in use).

## Project Structure

```
/
├── public/             # Static assets
├── src/                # Source code
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions
│   ├── mocks/          # API mocking
│   ├── pages/          # Page components
│   ├── providers/      # React context providers
│   └── store/          # Zustand state stores
└── docs/               # Project documentation
```

## Environment Variables

The project uses environment variables for configuration. Create a `.env` file in the project root with the following variables:

```
# None currently required for development with mock API
```

## Available Scripts

- `dev`: Start the development server with hot reloading
- `build`: Build the application for production
- `preview`: Preview the production build locally
- `test`: Run tests
- `lint`: Run ESLint to check code quality

## Deployment

The application is built using Vite, which produces optimized static assets for deployment.

1. Build the application:
```bash
npm run build
```

2. The built assets will be in the `dist` directory, which can be deployed to any static hosting service like:
- Vercel
- Netlify
- GitHub Pages
- Any static file server

## Mock API

During development, the application uses MSW (Mock Service Worker) to simulate API calls:

- API endpoints are defined in `src/mocks/handlers.ts`
- Mock WebSocket implementation is in `src/mocks/mockSocket.ts`
- Static data is stored in `src/staticData.ts`

## Testing

The project includes a testing setup with Vitest:

- Unit tests are located alongside the code they test
- Run tests with `npm run test`

## Styling

The project uses Tailwind CSS for styling:

- Tailwind configuration is in `tailwind.config.ts`
- Custom theme values are defined there (colors, fonts, etc.)
- The application uses shadcn/ui components, which are built on top of Tailwind

## Browser Compatibility

The application is designed to work on:
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
