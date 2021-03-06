const debug = require("debug")("koa");

const Koa = require("koa");
const Router = require("koa-router");
const bodyparser = require("koa-bodyparser");
const jwt = require("koa-jwt");
const jsonwebtoken = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");
const serve = require("koa-static");
const fallback = require("koa2-history-api-fallback");
const compress = require("koa-compress");

const connect = require("./mongodb/connect.js");
const find = require("./mongodb/find/find.js");
const create = require("./mongodb/create/create.js");
const update = require("./mongodb/update/update.js");
const remove = require("./mongodb/remove/remove.js");

const app = new Koa();
const onstage = new Router();
const backstage = new Router();


const find_view = find.find_view;
const find_use = find.find_use;
const find_article = find.find_article;
const find_article_main = find.find_article_main;
const find_draft = find.find_draft;
const find_draft_main = find.find_draft_main;
const find_login = find.find_login;

const create_draft = create.create_draft;
const create_article = create.create_article;
const create_update = create.create_update;
const create_login = create.create_login;

const update_use = update.update_use;
const update_draft = update.update_draft;
const update_article = update.update_article;
const update_update = update.update_update;
const update_login = update.update_login;

const remove_draft = remove.remove_draft;
const remove_article = remove.remove_article;
const remove_update = remove.remove_update;


function get_view(name){
  return async (ctx,next)=>{
    let code = 0;
    let data = {};

    try{
      data.view = await find_view(name);
      if(name === "main_model"){
        let use = await find_use();
        data.use = use[0];
      }
    }
    catch(err){
      code = 1;
      debug(err);
    }

    await next();
    ctx.body = {code,data};
  }
}

connect();


onstage.get("/api/get/main",get_view("main_model"));
onstage.get("/api/get/update",get_view("update_model"));
onstage.get("/api/get/diary",get_view("diary_model"));

onstage.get("/api/get/article",async (ctx,next)=>{
  let code = 0;
  let data = {};

  let _id = Number(ctx.query._id);//GET传入的_id是字符串类型
  let type = ctx.query.type;

  if(!Number.isInteger(_id)){
    code = 2;
    ctx.body = {code,data};
    return;
  }

  try{
    let array = await Promise.all([find_article(_id),find_article_main()]);
    let article_array = array[0];
    let main_array = array[1];

    if (article_array.length === 0){
      code = 2;
      ctx.body = {code,data};
      return;
    }

    let before_article = {};
    let article = {};
    let after_article = {};

    let article_index = null;
    main_array.some((value,index)=>{
      if(value._id === _id){
        article = value;
        article_index = index;
        return true;
      }
    });

    if(article_index !== null){
      before_article = main_array[article_index + 1];
      if(!before_article){before_article = {};}
      after_article = main_array[article_index - 1];
      if(!after_article){after_article = {};}
    }

    if(type === "show"){
      //mongoose返回的对象是不能添加或者删减属性的,故这里我们不能直接把content
      //作为article变量的新属性传给它.
      let content = article_array[0].article;
      data = {before_article,article,after_article,content};
    }else if(type === "edit"){
      let markdown = article_array[0].markdown;
      data = {article,markdown};
    }else{
      code = 1;
    }

  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  await new Promise((resolve)=>{
    setTimeout(()=>{resolve();},1000);
  });
  ctx.body = {code,data};
});


onstage.get("/api/get/draft_main",async (ctx,next)=>{
  let code = 0;
  let data = {};

  try{
    data = await find_draft_main();
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});

onstage.get("/api/get/draft",async (ctx,next)=>{
  let code = 0;
  let data = {};

  let _id = Number(ctx.query._id);

  if(!Number.isInteger(_id)){
    code = 2;
    ctx.body = {code,data};
    return;
  }

  try{
    let array = await find_draft(_id);
    if(array.length === 0){
      code = 2;
      ctx.body = {code,data};
      return;
    }
    data = array[0];
  }catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});




backstage.post("/api/post/create_draft",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    await create_draft(req_data);
    let draft_id = req_data._id;
    await update_use({draft_id});
    let res_array = await Promise.all([find_use(),find_draft_main()]);
    let use = res_array[0];
    data.use = use[0];
    data.draft_main = res_array[1];
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});

backstage.post("/api/post/update_draft",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    let _id = req_data._id;
    await update_draft(_id,req_data);
    data = await find_draft_main();
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});

backstage.post("/api/post/remove_draft",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    let _id = req_data._id;
    let draft_id = req_data.draft_id;
    await remove_draft({_id});
    if(draft_id != null){
      await update_use({draft_id});
    }
    let res_array = await Promise.all([find_use(),find_draft_main()]);
    let use = res_array[0];
    data.use = use[0];
    data.draft_main = res_array[1];
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});



backstage.post("/api/post/create_article",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    let main_data = req_data.main;
    let article_data = req_data.article;
    let article_id = article_data._id;

    await create_article(main_data,article_data);
    await update_use({article_id});
    let res_array = await Promise.all([find_use(),find_view("main_model")]);
    let use = res_array[0];
    data.use = use[0];
    data.view = res_array[1];
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});

backstage.post("/api/post/update_article",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    let main_data = req_data.main;
    let article_data = req_data.article;

    await update_article(main_data,article_data);
    let res_array = await Promise.all([find_use(),find_view("main_model")]);
    let use = res_array[0];
    data.use = use[0];
    data.view = res_array[1];
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});

backstage.post("/api/post/remove_article",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    let _id = req_data._id;
    let article_id = req_data.article_id;
    await remove_article({_id});
    if(article_id != null){
      await update_use({article_id});
    }
    let res_array = await Promise.all([find_use(),find_view("main_model")]);
    let use = res_array[0];
    data.use = use[0];
    data.view = res_array[1];
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});



backstage.post("/api/post/create_update",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    await create_update(req_data);
    let update_id = req_data._id;
    let update_version = req_data.version;
    await update_use({update_id,update_version});
    let res_array = await Promise.all([find_use(),find_view("update_model")]);
    let use = res_array[0];
    data.use = use[0];
    data.update = res_array[1];
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});

backstage.post("/api/post/update_update",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    let _id = req_data._id;
    await update_update(_id,req_data);
    data = await find_view("update_model");
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
})

backstage.post("/api/post/remove_update",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    let _id = req_data._id;
    let update_id = req_data.update_id;
    let update_version = req_data.update_version;
    await remove_update({_id});
    if(update_id != null){
      await update_use({update_id,update_version});
    }
    let res_array = await Promise.all([find_use(),find_view("update_model")]);
    let use = res_array[0];
    data.use = use[0];
    data.update_main = res_array[1];
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});



backstage.post("/api/post/update_tag",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    let tag = req_data.tag;
    await update_use({tag});
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});

backstage.post("/api/post/update_classify",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    let classify = req_data.classify;
    await update_use({classify});
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});




// onstage.post("/api/post/register",async (ctx,next)=>{
//   let code = 0;
//   let req_data = ctx.request.body;
//
//   let password = req_data.password;
//
//   let salt = bcrypt.genSaltSync(10);
//   let hash = bcrypt.hashSync(password,salt);
//   req_data._id = 0;
//   req_data.password = hash;
//
//   try{
//     let array = await find_login();
//     if(array.length === 0){
//       await create_login(req_data);
//     }else{
//       await update_login(req_data);
//     }
//   }
//   catch(err){
//     code = 1;
//     debug(err);
//   }
//
//   await next();
//   ctx.body = {code};
// });


onstage.post("/api/post/login",async (ctx,next)=>{
  let code = 0;
  let data = {};
  let req_data = ctx.request.body;

  try{
    let array = await find_login();
    let login = array[0];
    if(req_data.username === login.username
      && bcrypt.compareSync(req_data.password,login.password)){
      let token = jsonwebtoken.sign(
        {
          master: "dawkey",
          exp: Math.floor(Date.now()/1000) + 3600 * 24 * 15
        },login.secret
      );
      data.token = token;
    }else{
      code = 2;
    }
  }
  catch(err){
    code = 1;
    debug(err);
  }

  await next();
  ctx.body = {code,data};
});


onstage.post("/api/post/check_token",async (ctx,next)=>{
  let code = 0;
  let data = {};
  await next();
  ctx.body = {code,data};
});


find_login().then((res)=>{
  let secret = res[0].secret;

  app.use(compress({threshold: 2048}));

  app.use(fallback());

  app.use(serve(path.resolve("dist")));

  app.use(function (ctx,next){
    return next().catch((err)=>{
      if(err.status === 401){
        ctx.body = {
          code: 3,
          data: {error: err.originalError ? err.originalError.message : err.message}
        };
      }
      else{
        throw err;
      }
    });
  });

  app.use(jwt({secret}).unless({path: [/^\/api\/get/,/^\/api\/post\/login/]}));

  app.use(bodyparser());

  app.use(onstage.routes());

  app.use(backstage.routes());


  app.listen(3000,()=>{
    console.log("listen : 3000");
  });
});
