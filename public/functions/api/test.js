// 测试 KV 数据库是否正常（直接存+读）
export async function onRequestGet(context) {
  try {
    // 1. 先往数据库写入一条测试数据
    await context.env.USER_DB.put("test_user", JSON.stringify({
      name: "测试用户",
      email: "test@example.com",
      time: new Date().toISOString()
    }));

    // 2. 再读出来
    const data = await context.env.USER_DB.get("test_user");

    return Response.json({
      code: 200,
      msg: "KV 数据库正常！",
      userData: JSON.parse(data),
      tip: "去 Cloudflare KV 后台能看到这条数据"
    });

  } catch (err) {
    return Response.json({
      code: 500,
      msg: "KV 错误",
      error: err.message,
      tip: "请检查 KV 是否绑定成功 + 是否重新部署"
    });
  }
}