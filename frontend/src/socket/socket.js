import { io } from "socket.io-client";


const token = localStorage.getItem("token");

const socket = io(import.meta.env.VITE_BACKEND_URL, {
  autoConnect: false,
  auth: token ? { token } : {},
});

if (token) {
  socket.connect();
}

export default socket;
