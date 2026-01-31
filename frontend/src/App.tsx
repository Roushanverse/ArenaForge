import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import AuthLayout from "@/pages/auth/_layout";
import SignUpPage from "@/pages/auth/signup";
import LoginPage from "@/pages/auth/login";
import AppLayout from "@/pages/app/_layout";
import DashboardPage from "@/pages/app/dashboard";
import TournamentsPage from "@/pages/app/tournaments";
import TournamentDetailPage from "@/pages/app/tournaments/[id]";
import AdminPage from "@/pages/app/admin";
import NotFoundPage from "@/pages/404";
import AuthProvider from "@/contexts/AuthContext";

function App() {
  return (
    <AuthProvider>
      <main className="dark bg-background text-foreground">
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/auth/signup" element={<SignUpPage />} />
            <Route path="/auth/login" element={<LoginPage />} />
          </Route>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tournaments" element={<TournamentsPage />} />
            <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </main>
    </AuthProvider>
  );
}

export default App;