
class Bot{

    constructor(settings,manager, community){
        this.settings = settings;
        this.manager = manager;
        this.community = community;
    }

    // Polling que checa a url do site.
    botCheckStart(){
       
        var request = require('request');
        var _this = this;
        var interval = setInterval(function(){
                request(_this.settings.botUrl, function (error, response, body) {
                    
                    if(body!=undefined && body.trim().length>0){
                        // existe skin a ser enviada
                        var jsonToSend = {};
                        try{
                            jsonToSend = JSON.parse(body);
                        }catch(e){
                            jsonToSend.tradeoffertoken = undefined;
                        }                        
                        if(global.isTrading!=jsonToSend.id){
                            global.isTrading=jsonToSend.id;                            
                            global.eventEmitter.emit("sendItem",jsonToSend.steamid, jsonToSend, jsonToSend.id,jsonToSend.tradeoffermessage);
                        }
                    }else{
                        
                        //console.log("Nada!");
                    }
                });
            
        },this.settings.botUrlPollingInSeconds*1000);
    }


    prepareItemToSend(json){
        if(json.givepubgitems!=undefined && json.givepubgitems.length>0)
            return {
                "id" : json.givepubgitems,
                "contextid": 2, 
                "appid": 440
            };;
        if(json.givecsgoitems!=undefined && json.givecsgoitems.length>0)
            return {
                "id" : json.givecsgoitems,
                "contextid": 2, 
                "appid": 730
            };
    }

}
module.exports = Bot

 