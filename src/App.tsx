import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { router } from '@/lib/router';

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="kread-ui-theme">
      <TooltipProvider delayDuration={0}>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
