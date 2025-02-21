import { ThemeProvider } from "@/components/theme-provider"
import Auth from "./pages/Auth"
import { Toaster } from "@/components/ui/toaster"
import { Routes, Route } from "react-router-dom";

const App = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/auth" element={<Auth />}/>
      </Routes>
      <Toaster />
    </ThemeProvider>
  )
}

export default App