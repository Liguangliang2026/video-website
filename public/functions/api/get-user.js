export async function onRequestPost(context) {
    try {
      const email = "test@gmail.com";
  
      // 读取
      const data = await context.env.USER_DB.get(email);
  
      return Response.json({
        code: 200,
        msg: "读取成功",
        user: JSON.parse(data)
      });
    } catch (e) {
      return Response.json({ code: 500, msg: "读取失败" });
    }
  }