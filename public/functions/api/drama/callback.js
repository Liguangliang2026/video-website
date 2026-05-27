import { aesDecrypt } from './utils.js';

export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    const body = await request.json();

    // 你文档给的官方测试密文（可直接测）
    // const data = await aesDecrypt(
    //   "S682k9HksaSbNRuEvVtsAbHDbDGMlMhfIsDHfz3S961e1a9uUWVO3X9aE58+LxTEBbLTey7q5OIw+yM6SKQS9TW7FjoKmKnsHSgNGyCJWuTtx5XfWwukaZyiHtv0g1tx4aTSPHLUlvXcyDXhZ9RtICooUfu5RTAAO5KRR4E6SlxG/GSEglhnfpkT/LpA1JJSPHmN+1++1JXTIozp70kTDvyKzjc50a8Jpde9VGsbaiEmJYieerUjdS0ZQGNLacLe8dQeIh+nL5KhZsbg96Yj3Q==",
    //   "jklhgfdahfgdjkij",
    //   "8y1TF3fjkg2a6s3Y"
    // );

    const data = await aesDecrypt(
      body.data || body.encrypt_data,
      env.DRAMA_AES_KEY,
      env.DRAMA_AES_IV
    );

    return Response.json({
      code: 0,
      msg: "success",
      data: JSON.parse(data)
    });
  } catch (err) {
    return Response.json({ code: -1, error: err.message });
  }
}