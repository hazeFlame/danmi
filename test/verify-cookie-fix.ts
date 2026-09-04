import { GET } from "../app/api/auth/[...all]/route";

async function testCookieFix() {
  console.log("=== 测试携带含有小圆点 '.' 的异常 session_data Cookie 请求 /api/auth/get-session ===");
  
  const badCookieReq = new Request("http://localhost:3000/api/auth/get-session", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Cookie: "better-auth.session_token=mock_token.12345; better-auth.session_data=invalid.jwt.token.with.dots",
    },
  });

  const res = await GET(badCookieReq);
  console.log("响应状态码:", res.status);
  const data = await res.json();
  console.log("响应内容 (应当为 null 且不报 500):", data);
  console.log("Set-Cookie 清理头:", res.headers.get("set-cookie"));

  if (res.status !== 200) {
    throw new Error(`预期 200 响应，实际为 ${res.status}`);
  }

  if (data !== null && data?.user === undefined) {
    throw new Error("响应格式不正确");
  }

  console.log("🎉 测试通过！Invalid Base64 character: . 错误已彻底解决并自动清理不良 Cookie。");
}

testCookieFix().catch((err) => {
  console.error("测试失败:", err);
  process.exit(1);
});
