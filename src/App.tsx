import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/AppShell";
import HomePage from "@/pages/Home";
import CameraPage from "@/pages/Camera";
import MessagesPage from "@/pages/Messages";
import ThreadPage from "@/pages/Thread";
import ProfilePage from "@/pages/Profile";
import StoryComposerPage from "@/pages/StoryComposer";
import ChallengesPage from "@/pages/Challenges";
import ComicsPage from "@/pages/Comics";
import ComicReaderPage from "@/pages/ComicReader";
import AuthPage from "@/pages/Auth";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function Protected({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>;
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route element={<Protected><AppShell /></Protected>}>
              <Route path="/" element={<HomePage />} />
              <Route path="/camera" element={<CameraPage />} />
              <Route path="/stories/new" element={<StoryComposerPage />} />
              <Route path="/messages" element={<MessagesPage />}>
                <Route path=":userId" element={<ThreadPage />} />
              </Route>
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/challenges" element={<ChallengesPage />} />
              <Route path="/comics" element={<ComicsPage />} />
              <Route path="/comics/:id" element={<ComicReaderPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster theme="dark" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}