export async function onRequestGet(context) {
    return Response.json({
      code: 200,
      data: {
        uid: "google_123456",
        name: "谷歌用户",
        email: "user@gmail.com",
        avatar: ""
      }
    });
  }