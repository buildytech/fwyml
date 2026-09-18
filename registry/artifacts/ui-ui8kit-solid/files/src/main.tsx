import { render } from "solid-js/web";
import { App } from "./App.solid";
import "./assets/styles/theme.css";
import "./app.css";

const target = document.getElementById("app");
if (!target) {
  throw new Error("Application root #app is missing.");
}

render(() => <App />, target);
