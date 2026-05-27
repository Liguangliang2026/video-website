export async function onRequestPost(context) {
    try {
      // 模拟谷歌用户信息
      const user = {
        uid: "google_1001",
        email: "test@gmail.com",
        name: "Test User",
        picture: "https://test.com/avatar.png"
      };
  
      // 保存到 Cloudflare KV 数据库
      await context.env.USER_DB.put(user.email, JSON.stringify(user));
  
      return Response.json({
        code: 200,
        msg: "用户已保存到 Cloudflare 数据库！",
        user: user
      });
    } catch (e) {
      return Response.json({ code: 500, msg: "保存失败：" + e.message });
    }
  }