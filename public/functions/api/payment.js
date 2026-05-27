export async function onRequestPost(context) {
    try {
      const { packageName, productId, purchaseToken } = await context.request.json();
  
      // 这里将来验证谷歌支付订单
      return Response.json({
        code: 200,
        msg: "谷歌支付验证成功",
        status: "paid"
      });
  
    } catch (e) {
      return Response.json({ code: 500, msg: "支付验证失败" });
    }
  }