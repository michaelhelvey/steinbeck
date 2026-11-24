import { render } from "@solidjs/web";
import { App } from "./App.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("index.html must contain an element with id 'root'");
}

render(() => <App />, root);
