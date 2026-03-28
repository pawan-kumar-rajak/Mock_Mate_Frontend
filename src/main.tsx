import { StrictMode } from "react";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createRoot } from "react-dom/client";
import Home from "./pages/Home";
import SignIn from "./pages/SignIn.tsx";
import SignUp from "./pages/SignUp.tsx";
import Quiz from "./pages/Quiz.tsx";
import QuizSelector from "./components/QuizSelector.tsx";
import { Empty } from "antd";
import TTS_STT_Test from "./components/TTS_STT_Test.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import App from "./App.tsx";
import InterviewSetup from "./pages/InterviewSetup.tsx";
import InterviewRoom from "./pages/InterviewRoom.tsx";
import InterviewReport from "./pages/InterviewReport.tsx";
import GdLobby from "./pages/GdLobby.tsx";
import GdRoom from "./pages/GdRoom.tsx";
import axios from "axios";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/about",
        element: <h1>About</h1>,
      },
      {
        path: "/signin",
        element: <SignIn />,
      },
      {
        path: "/signup",
        element: <SignUp />,
      },
      {
        path: "/test",
        element: <TTS_STT_Test />,
      },
      {
        path: "/interview",
        element: <InterviewSetup />,
      },
      {
        path: "/interview/:sessionId",
        element: <InterviewRoom />,
      },
      {
        path: "/interview/:sessionId/report",
        element: <InterviewReport />,
      },
      {
        path: "/quizselector",
        element: <QuizSelector />,
        loader: async () => {
          try {
            const response = await axios.get(
              `${import.meta.env.VITE_BACKEND_URL}/quizzes/skills`,
              {
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
                },
              },
            );
            return response.data;
          } catch (error) {
            console.error("Error fetching preset skills:", error);
          }
        },
      },
      {
        path: "/quiz",
        element: <Quiz />,
      },
      {
        path: "/gd",
        element: <GdLobby />,
      },
      {
        path: "/gd/room/:roomId",
        element: <GdRoom />,
      },
      {
        path: "*",
        element: <Empty />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
