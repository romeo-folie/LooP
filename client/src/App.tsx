import { ThemeProvider } from "@/components/theme-provider"
import Auth from "./pages/Auth"
import { Toaster } from "@/components/ui/toaster"


interface AppProps {
  children?: React.ReactNode
};

const App: React.FC<AppProps> = ({children}) => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      {children}
      <Toaster />
      <Auth />
    </ThemeProvider>
  )
}

export default App
