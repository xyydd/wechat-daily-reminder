var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var wechatRouter = require('./routes/wechat');
const axios = require("axios");
const moment = require("moment");
const fs = require('fs');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);


app.use("/wechat", wechatRouter);

function getToken() {
    return new Promise((resolve, reject) => {
        const tokenFile = path.join(__dirname, 'token.json');
        fs.readFile(tokenFile, 'utf-8', function (err, data) {
            if (err) {
                reject(err)
            } else {
                if (data) {
                    const token = JSON.parse(data)
                    if (token.expires_in > moment().unix()) {
                        resolve(token.access_token)
                        return
                    }
                }
                const appid = ''
                const appsecret = ''
                axios.get(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${appsecret}`)
                    .then(res => {
                        resolve(res.data.access_token)
                        const t = res.data
                        t.expires_in = t.expires_in + moment().unix() - 1200
                        fs.writeFile(tokenFile, JSON.stringify(t, "", "\t"), function (err) {
                            if (err) {
                                reject(err)
                            }
                        })
                    })
                    .catch(err => reject(err))
            }
        })

    })
}

const week = ['日', '一', '二', '三', '四', '五', '六']

const cycle = setInterval(async function () {
    const h = moment().hour();
    const m = moment().minute();
    if (h === 9 && m === 0) {
        console.log('开始发送消息')
        const today = moment()
        const lastWage = moment(moment().format('YYYY-MM-15'), 'YYYY-MM-DD').add(1, 'M')
        const wageDate = lastWage.diff(today, 'days')
        console.log('开始获取天气')
        let weatherinfo = await axios.get('https://restapi.amap.com/v3/weather/weatherInfo?key=&city=330502&extensions=all&output=JSON')
        weatherinfo = weatherinfo.data
        if (weatherinfo.status === '1') {
            let todayweather = weatherinfo.forecasts[0].casts[0]
            console.log('获取天气', todayweather)
            getToken()
                .then(token => {
                    console.log('发送')
                    sendMessage(token, 'oAFwd5iWjH7Um3B3KjzNjopcpKIU', wageDate, todayweather)
                    sendMessage(token, 'oAFwd5v4nEMytML69v7EvKLVxyxM', wageDate, todayweather)
                })
                .catch(err => {
                    console.log(err)
                    clearInterval(cycle)
                })
        }
    }
}, 1000 * 60)
function sendMessage (token, touser, wageDate, weatherinfo) {
    axios.post('https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=' + token, {
        touser: touser,
        template_id: '', // 模板信息id
        topcolor: '#FF0000',
        data: {
            Date: {
                value: moment().format('YYYY-MM-DD') + ', ' + '星期' + week[moment().weekday()],
                color: '#2b85e4'
            },
            Wage: {
                value: '发工资',
                color: '#ed4014'
            },
            WageDate: {
                value: wageDate,
                color: '#ed4014'
            },
            Weather: {
                value: weatherinfo.dayweather,
                color: '#ff9900'
            },
            TemperatureLow: {
                value: weatherinfo.nighttemp + '℃',
                color: '#19be6b'
            },
            TemperatureHigh: {
                value: weatherinfo.daytemp + '℃',
                color: '#2d8cf0',
            }
        }
    })
        .then(res => {
            console.log(res.data)
        })
        .catch(err => {
            console.log(err)
        })
}
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
