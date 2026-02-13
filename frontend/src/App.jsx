import { Routes, Route, Navigate } from "react-router";
// import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Signup from "./pages/SignUp";
import HomeLayout from "./layouts/HomeLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Profile from "./pages/Profile";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/" element={
        <ProtectedRoute>
          <HomeLayout />
        </ProtectedRoute>
      }
      >

        <Route
          index
          element={
            <div className="empty-chat">
              <div className="empty-chat-content">
                <h2>Welcome 👋</h2>
                <p>Select a user to start chatting</p>
              </div>
            </div>
          }
        />

        <Route path="chat/:userId" element={<Chat />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;