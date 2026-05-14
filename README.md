# auditely

## Project Structure

```
app/
├── (pages)/
│   ├── (auth)/              # Authentication pages (login, register)
│   │   ├── login/
│   │   └── layout.tsx
│   └── (dashboard)/         # Protected routes
│       ├── dashboard/
│       └── layout.tsx
├── _shared/                 # Shared code
│   ├── components/
│   │   ├── ui/             # UI primitives (Button, Input, Modal, etc.)
│   │   ├── forms/          # Form-specific components
│   │   └── providers/      # StoreProvider, ThemeProvider, ToastProvider
│   └── lib/
│       ├── api/            # Axios + interceptors
│       ├── config/         # Routes configuration
│       ├── hooks/          # useAuth, useTheme, useRedux
│       ├── store/          # Redux slices
│       ├── types/          # TypeScript types
│       ├── utils/          # Cookie utilities
│       └── validations/    # Yup schemas
├── api/                    # Next.js API routes
├── layout.tsx             # Root layout
├── globals.css            # Tailwind + CSS variables
├── loading.tsx            # Global loading UI
├── error.tsx              # Global error boundary
└── not-found.tsx          # 404 page

public/
├── icons/                 # SVG icons (exported via index.ts)
├── images/                # Images (exported via index.ts)
└── fonts/                 # Custom fonts (exported via index.ts)

proxy.ts                   # Auth middleware (Next.js 16)
next.config.ts             # Next.js configuration
package.json               # Dependencies
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Features

- ⚡ Next.js 16 with App Router
- 🔐 Authentication with token refresh
- 🎨 Tailwind CSS + SCSS hybrid styling
- 🌙 Dark/Light mode support
- 📦 Redux Toolkit with persistence
- 📝 Formik + Yup form validation
- 🔔 Toast notifications
- 🎨 18+ UI components

## Project Documentation

- `AGENT.md` - Project conventions and rules (for AI assistance)
- `.agent/skills/` - Detailed skill files for specific tasks

> Note: AGENT.md and .agent/ are gitignored and meant for AI agent assistance only.
