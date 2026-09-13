import { AuthProvider } from "../components/AuthProvider";
import "../styles/globals.css";
function MyApp({ Component, pageProps }) {
  return /* @__PURE__ */ React.createElement(AuthProvider, null, /* @__PURE__ */ React.createElement(Component, { ...pageProps }));
}
export default MyApp;
