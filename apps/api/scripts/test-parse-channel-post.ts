import { parseChannelPost } from "../src/telegram/parseChannelPost.js";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const a = parseChannelPost(`Футболка Oakley 00s

> состояние отличное
> размер L
> цена: 6990
`);
assert(a?.title === "Футболка Oakley 00s", "title A");
assert(a?.priceRub === 6990, "price A");
assert(a?.size === "L", "size A");
assert(a?.conditionText === "отличное", "condition A");

const b = parseChannelPost(`Куртка Nike
цена 4500
замеры: плечи 48, длина 72`);
assert(b?.title === "Куртка Nike", "title B");
assert(b?.priceRub === 4500, "price B");
assert(b?.measurements?.includes("плечи"), "meas B");

const c = parseChannelPost(`Винтажные джинсы
8990
грудь 56 / длина 68`);
assert(c?.title === "Винтажные джинсы", "title C");
assert(c?.priceRub === 8990, "price C");
assert(c?.measurements?.includes("грудь"), "meas C");

const skip = parseChannelPost(`Футболка
цена 1000
https://example.com/i/VTG-000001`);
assert(skip === null, "skip own posts");

console.log("parseChannelPost tests OK");
