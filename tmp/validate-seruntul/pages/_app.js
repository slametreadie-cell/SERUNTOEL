import { jsx } from "react/jsx-runtime";
import { AuthProvider } from "../components/AuthProvider";
import "../styles/globals.css";
function MyApp({ Component, pageProps }) {
  return /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(Component, { ...pageProps }) });
}
export default MyApp;
