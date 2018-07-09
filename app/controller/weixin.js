const Controller = require('egg').Controller;
const consequencer = require('./../utils/consequencer');
const encryption = require('./../utils/encryption');
const postjsonby = require('./../utils/postjsonbyhttps');
const parseString = require('xml2js').parseString;

class WeixinController extends Controller {
    async index() {
        this.ctx.body = 'Hello ~~~ Welcome to Rejiejay server side and your place in weixin';
    }

    /**
     * 验证开发者服务器 正确响应微信发送的Token验证
     * @return {string} echostr {};
     */
    async handle() {
        let request = this.ctx;

        // 判断参数
        if (!request.query || !request.query.signature || !request.query.echostr || !request.query.timestamp || !request.query.nonce) {
            return this.ctx.body = consequencer.error('参数错误!');
        }

        // 将token、timestamp、nonce三个参数进行字典序排序 拼接成一个字符串
        let hashcodeString = ['RejiejayWeChatHandleToken', request.query.timestamp, request.query.nonce].sort().join('');
        // sha1加密
        let hashcode = encryption.sha1ToLowerCase(hashcodeString);

        if (hashcode === request.query.signature) {
            return this.ctx.body = request.query.echostr;
        } else {
            return this.ctx.body = consequencer.error('Token验证失败!');
        }
    }

    /**
     * 获取公众号的全局唯一接口调用凭据
     * @return {string} access_token '11_Hi0KxrnvVN_RP47QqLd6_lkV8EAgKSLG_CL28rFgJd4eMaVc0g4jEOIgZ_BulbYXvKcGUTVfN6aaQHpY-xNxiTPO7c5xU_Yj7nRS7bpRtYPsT1K61xG2haGyAcgFzDl9KfCGmKBJyK9SKX8wYBMbAEAGJU'
     */
    async getGlobalAccess_token() {
        let myAccessToken = await this.ctx.service.weixin.getGlobalAccess_token();

        // 查询失败
        if (myAccessToken.result !== 1) {
            return this.ctx.body = myAccessToken;
        }

        // 查询成功
        if (myAccessToken.data.value && typeof(myAccessToken.data.value) === 'string') { // 判断格式是否正确
            return this.ctx.body = consequencer.success({
                access_token: myAccessToken.data.value
            });
        } else {
            return this.ctx.body = consequencer.error('查询数据格式有误!');
        }
    }

    /**
     * 文本消息
     * @param {xml} xml 
     * <xml>
     *   <ToUserName>rejiejay</ToUserName>
     *   <FromUserName>oI0FV0pK5sqCnE_LBBXb6sxdROwg</FromUserName>
     *   <CreateTime>1348831860</CreateTime>
     *   <MsgType>text</MsgType>
     *   <Content>this is a test</Content>
     *   <MsgId>1234567890123456</MsgId>
     * </xml>
     * @return {boolen} 是否成功创建
     */
    async messageHandle() {
        const _this = this;

        // 获取 body
        let xmlJsonResult = await new Promise((resolve, reject) => {
            let XML = '';
            
            _this.ctx.req.on('data', chunk => XML += chunk);

            _this.ctx.req.on('end', () => {
                try {
                    // 解析 XML
                    parseString(decodeURI(XML), (err, result) => {
                        if (err) {
                            return reject(`解析xml失败, 原因: ${err}`);
                        }
                        resolve(result);
                    });
                } catch (error) {
                    reject(`解析xml失败, 原因: ${error}`);
                }
            });
        })
        .then(
            xmlJson => consequencer.success(xmlJson),
            error => consequencer.error(error)
        ).catch(error => consequencer.error(error));

        // 解析 xml
        if (xmlJsonResult.result !== 1) {
            // {
            //     "result": 1,
            //     "data": {
            //         "xml": {
            //             "URL": ["https://www.rejiejay.cn/server/weixin/messagehandle"],
            //             "ToUserName": ["rejiejay"],
            //             "FromUserName": ["oI0FV0pK5sqCnE_LBBXb6sxdROwg"],
            //             "CreateTime": ["1348831860"],
            //             "MsgType": ["text"],
            //             "Content": ["thisIsATest"],
            //             "MsgId": ["1234567890123456"]
            //         }
            //     },
            //     "message":"success"
            // }
            return this.ctx.body = xmlJsonResult;
        }

        // 判断是否文本消息
        let xmlJson = xmlJsonResult.data.xml;
        if (xmlJson.MsgType[0] !== 'text') {
            return this.ctx.body = 'success';
        }

        // 回复文本消息
        this.ctx.res.writeHead(200, {
            'Content-Type': 'application/xml;charset=UTF-8'
        });
        this.ctx.res.write('<xml>');
        this.ctx.res.write('<ToUserName>' + xmlJson.ToUserName[0] + '</ToUserName>');
        this.ctx.res.write('<FromUserName>' + xmlJson.FromUserName[0] + '</FromUserName>');
        this.ctx.res.write('<CreateTime>' + Date.parse(new Date()) + '</CreateTime>');
        this.ctx.res.write('<MsgType>text</MsgType>');
        this.ctx.res.write('<Content>你好,' + xmlJson.FromUserName[0] + '.你的openid为:' + xmlJson.FromUserName[0] + '</Content>');
        this.ctx.res.end('</xml>');
    }

    /**
     * 创建菜单界面 (作废 因为公众号 需要通过认证)
     * @return {boolen} 是否成功创建
     */
    async createMenu() {
        return this.ctx.body = '接口已废弃';
        let myAccessToken = await this.ctx.service.weixin.getGlobalAccess_token();
        
        // 查询失败
        if (myAccessToken.result !== 1) {
            return this.ctx.body = consequencer.error(`获取access_token失败! 原因: ${myAccessToken.message}`);
        }

        let myMenu = [
            {
                'type': 'click',
                'name': '测试按钮',
                'key': 'V1001_TODAY_MUSIC'
            }
        ];
        let mycreate = await postjsonby(
            'api.weixin.qq.com', 
            `/cgi-bin/menu/create?access_token=${myAccessToken.data.value}`, 
            myMenu
        ).then(
            success => consequencer.success(success),
            error => consequencer.error(`请求微信服务器出现错误, 原因${error}. 请求myAccessToken: ${myAccessToken.data.value}`, -200, error)
        );

        return this.ctx.body = mycreate;
    }

    
}

module.exports = WeixinController;
