import { jsx as t, jsxs as a } from "react/jsx-runtime";
import { usePolling as n, callService as d, TwoToneBase as s, formatRelativeTime as m, Group as c, TextField as i, setIn as o } from "@glassboard/sdk";
const h = ({ config: e }) => {
  const { data: l, error: r } = n(
    () => d("hello", { cardId: e.id }),
    { interval: 3e4, key: e.id }
  );
  return /* @__PURE__ */ t(s, { title: e.title || "Hello", icon: e.icon || "lu-Hand", subtitle: "Example plugin", children: /* @__PURE__ */ a("div", { className: "hello-card", children: [
    r && /* @__PURE__ */ t("p", { className: "hello-card-error", children: r }),
    /* @__PURE__ */ t("p", { className: "hello-card-greeting", children: l?.greeting ?? "…" }),
    l?.time && /* @__PURE__ */ a("p", { className: "hello-card-time", children: [
      "Server time, ",
      m(l.time)
    ] })
  ] }) });
}, p = ({ config: e, onChange: l }) => /* @__PURE__ */ a(c, { title: "Greeting", children: [
  /* @__PURE__ */ t(i, { label: "Title", value: e.title, placeholder: "Hello", onChange: (r) => l(o(e, ["title"], r)) }),
  /* @__PURE__ */ t(i, { label: "Name", value: e.name, placeholder: "there", hint: "Who the card greets.", onChange: (r) => l(o(e, ["name"], r)) })
] }), v = {
  id: "hello",
  name: "Hello",
  register(e) {
    e.registerCard("hello", {
      Component: h,
      name: "Hello",
      description: "A greeting from the server, from the example plugin",
      icon: "lu-Hand",
      sizes: ["1", "2"],
      defaults: { name: "" },
      Editor: p,
      headerIcon: !0
    });
  }
};
export {
  v as default
};
