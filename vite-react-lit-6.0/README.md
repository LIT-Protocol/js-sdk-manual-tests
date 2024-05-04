# vite-react-6.\* test

# !! Important !!

- Edit your `vite.config.ts` with the following global object shim

```
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";


export default defineConfig({
  plugins: [react()],
  define: {
    global: "window",
  },
});
```
