// 查看所有付费用户（管理员）
export async function onRequestPost(context) {
    const { password } = await context.request.json();
    if (password !== context.env.ADMIN_PASSWORD) {
      return Response.json({ code: 403, msg: '密码错误' });
    }
  
    const list = [];
    const memberKeys = await context.env.USER_DB.list({ prefix: 'member:' });
    for (const key of memberKeys.keys) {
      const userId = key.name.replace('member:', '');
      const subStr = await context.env.USER_DB.get(`sub:${userId}`);
      const sub = subStr ? JSON.parse(subStr) : {};
      list.push({
        userId,
        email: sub.customer?.email || '',
        planId: sub.plan_id,
        expireAt: sub.current_period_end
      });
    }
    return Response.json({ code: 200, list });
  }