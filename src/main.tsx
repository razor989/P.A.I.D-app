import { bootstrap } from "@/app/bootstrap";
import "@/presentation/styles/base.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("Application root element was not found.");
}

bootstrap(root);
