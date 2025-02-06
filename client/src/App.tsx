import { ThemeProvider } from "@/components/theme-provider"
import Auth from "./pages/Auth"

interface AppProps {
  children?: React.ReactNode
};

function App({children}: AppProps) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      {/* {children} */}
      <Auth />
    </ThemeProvider>
  )
}

export default App
