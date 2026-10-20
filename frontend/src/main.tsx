import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from 'react-router-dom';
import { PlayersPage } from './pages/PlayersPage.js';
import { ClubsPage } from './pages/ClubsPage.js';
import { ClubDetailPage } from './pages/ClubDetailPage.js';
import { Toaster } from './components/ui/sonner.js';
import './styles.css';

const queryClient = new QueryClient();
const router = createBrowserRouter([
  { path: '/jogadores', element: <PlayersPage /> },
  { path: '/clubes/:clubId', element: <ClubDetailPage /> },
  { path: '/clubes', element: <ClubsPage /> },
  { path: '*', element: <Navigate to="/jogadores" replace /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" theme="light" />
    </QueryClientProvider>
  </React.StrictMode>,
);
