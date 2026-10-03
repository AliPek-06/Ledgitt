import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { CurrentUserProvider } from "./context/CurrentUserContext";
import Home from "./pages/Home";
import Join from "./pages/Join";
import NotFound from "./pages/NotFound";
import TeacherAssignment from "./pages/TeacherAssignment";
import TeacherNew from "./pages/TeacherNew";
import TeamCharter from "./pages/TeamCharter";
import TeamWorkspace from "./pages/TeamWorkspace";

export default function App() {
  return (
    <CurrentUserProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="/teacher/new" element={<TeacherNew />} />
            <Route path="/teacher/:assignmentId" element={<TeacherAssignment />} />
            <Route path="/join/:code" element={<Join />} />
            <Route path="/team/:teamId/charter" element={<TeamCharter />} />
            <Route path="/team/:teamId" element={<TeamWorkspace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CurrentUserProvider>
  );
}
