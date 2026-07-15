import { io } from "socket.io-client";
import { SERVER_URL } from "./config.js";

class Net {
  constructor() {
    this.socket = null;
    this.listeners = {};
  }

  connect() {
    this.socket = io(SERVER_URL, { transports: ["websocket", "polling"] });
    return this.socket;
  }

  join(name) {
    this.socket.emit("player:join", name);
  }

  move(x, y) {
    this.socket.emit("player:move", { x, y });
  }

  castLine() {
    this.socket.emit("fish:cast");
  }

  reel(accuracy) {
    this.socket.emit("fish:reel", accuracy);
  }

  sendChat(text) {
    this.socket.emit("chat:message", text);
  }
}

export const net = new Net();
