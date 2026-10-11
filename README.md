# ⚡ Digital Sim

- _Digital Sim_ is a modern, web-based digital logic circuit simulator built
  with SvelteKit, TypeScript, and DaisyUI. It allows users to design, simulate,
  and interact with digital logic components directly in the browser, featuring
  robust schema validation using Zod for circuit configuration parsing and serialization.

---

## ✨ Features

- **Interactive Circuit Simulation:** Construct, inspect, and evaluate digital logic
  circuits in real time.
- **Schema Validation & Storage:** Leverages [Zod](https://zod.dev/) to safely parse,
  validate, and serialize circuit states and objects for export/import.
- **Modern UI / UX:** Built with Tailwind CSS and [DaisyUI](https://daisyui.com/)
  for a sleek, responsive, and accessible interface.
- **Edge Deployment:** Configured out-of-the-box for serverless edge deployment
  on Cloudflare Workers.

---

## 🛠️ Tech Stack

- **Framework:** [SvelteKit](https://svelte.dev/) (TypeScript)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
- **Validation:** [Zod](https://zod.dev/)
- **Package Manager & Runtime:** [Bun](https://bun.sh/)
- **Testing:** [Vitest](https://vitest.dev/)
- **Deployment Adapter:** `@sveltejs/adapter-cloudflare` (Cloudflare Workers)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Bun](https://bun.sh/) installed on your machine.

### 1. Clone the Repository

```bash
git clone https://git.sdickinson.com/sdickinson/digital-sim.git
cd digital-sim
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Run Development Server

```bash
bun run dev

# Or start the server and open automatically in your browser:
bun run dev -- --open
```

---

## 🧪 Testing

To run the unit and component test suite powered by Vitest:

```bash
bun run test
```

---

## 📦 Building & Deployment

### Production Build

Create an optimized production build:

```bash
bun run build
```

Preview the production build locally:

```bash
bun run preview
```

### Cloudflare Workers Deployment

This project uses `@sveltejs/adapter-cloudflare` and Wrangler for deployment.
Ensure you are authenticated with Cloudflare via Wrangler, then run:

```bash
bun run deploy
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
