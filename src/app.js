/**
 * Faz a leitura das configurações para que o bot funcione.
 */
settingsJson = process.argv.slice(2)[0];
if (settingsJson == undefined) {
    console.log("É necessário definir o arquivo de configurações que vai usar.");
    return false;
}
var settings = require(`./settings/${settingsJson}`);

/**
 * Inclui no projeto as libs necessárias
 */
const SteamUser = require("steam-user");
const SteamTotp = require("steam-totp");
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const Bot = require('./includes/Bot.js');
const request = require('request');
const events = require('events');
const Logs = require('./includes/Logs.js');
const fs = require('fs');


global.isTrading = false;

/**
 * Instancia os objetos necessários
 */
const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    community: community,
    language: 'en',
    pollInterval: settings.botCheckPollingInSeconds * 1000,
    cancelTime: settings.botCancelTimeInSeconds * 1000
});
global.eventEmitter = new events.EventEmitter();
const log = new Logs(settings);


/**
 * Pega a loginKey
 */
var loginKey;
var keyFile = 'keys/' + settings.accountName + '.key';
fs.readFile(keyFile, "utf8", function (err, data) {
    if (data) {
        loginKey = data;
    } else {
        client.on('loginKey', function (key) {
            log.msg('info', 'New login key was generated: ' + key);
            fs.writeFile(keyFile, key, function () { });
        });
    }
});

/**
 * Pega a diferença de time da Steam pra máquina que está rodando
 */
global.timeOffset;
SteamTotp.getTimeOffset(function (error, offset, latentcy) {
    global.timeOffset = offset + latentcy;
});

/**
 * Seta as configurações de logon, e faz o logon efetivamente
 */
client.setOption("promptSteamGuardCode", false);
logInSettings = {
    accountName: settings.accountName,
    password: settings.accountPass,
    twoFactorCode: SteamTotp.getAuthCode(settings.secret.shared),
    rememberPassword: true,
    loginKey: loginKey
}
client.logOn(logInSettings);

/**
 * Caso gere uma nova loginKey ele grava.
 */


/**
 * Caso dê erro na hora de gerar o steamGuard, ele gera um novo.
 */
client.on("steamGuard", function (domain, callback, lastCodeWrong) {
    if (lastCodeWrong) {
        log.msg("info", "Last code wrong, try again!");
    }
    log.msg("info", "Generating a new Steam Guard code");
    setTimeout(() => {
        var code = SteamTotp.generateAuthCode(settings.secret.shared, SteamTotp.getTimeOffset(function (error, offset, latentcy) {
            global.timeOffset = offset + latentcy;
        }));
        callback(code);
    }, 5000);
});


/**
 * Evento que dispara quando efetua login
 */
client.on('loggedOn', () => {
    log.msg("normal", "Logged into Steam");
});


/**
 * Evento que dispara quando a WebSession starta
 */
client.on('webSession', (sessionid, cookies) => {
    log.msg("normal", "WebSession is up!");

    /**
     * Set cookies 
     */
    manager.setCookies(cookies);
    community.setCookies(cookies);

    client.setPersona(SteamUser.Steam.EPersonaState.Online, settings.botDisplayName);

    // Starta o polling do bot.
    var bot = new Bot(settings, manager, community);
    bot.botCheckStart(settings);

});


manager.on("sentOfferChanged", function (offer, oldState) {
    switch (offer.state) {
        case 1:
            // console.log("Invalid");
            request(settings.botUrl + `?declined=${offer.id}&apikey=${settings.secret.apikey}`);
            log.msg("error", `[ERROR 7] Offer #${offer.id} was Invalid`);
            global.isTrading = false;
            break;
        case 2:
            // console.log("Active");
            break;
        case 3:
            request(settings.botUrl + `?accepted=${offer.id}&apikey=${settings.secret.apikey}`);
            //console.log("Accepted");
            log.msg("success", `[SUCCESS] Offer #${offer.id} accepted`);
            global.isTrading = false;
            break;
        case 4:
            // console.log("Countered");
            break;
        case 5:
            // console.log("Expired");
            request(settings.botUrl + `?declined=${offer.id}&apikey=${settings.secret.apikey}`);
            log.msg("error", `[ERROR 4] Offer #${offer.id} was expired`);
            global.isTrading = false;
            break;
        case 6:
            // console.log("Canceled");
            request(settings.botUrl + `?declined=${offer.id}&apikey=${settings.secret.apikey}`);
            log.msg("error", `[ERROR 5] Offer #${offer.id} was canceled`);
            global.isTrading = false;
            break;
        case 7:
            // console.log("Declined");
            request(settings.botUrl + `?declined=${offer.id}&apikey=${settings.secret.apikey}`);
            log.msg("error", `[ERROR 6] Offer #${offer.id} was declined`);
            global.isTrading = false;
            break;
        case 8:
            // console.log("InvalidItems");
            request(settings.botUrl + `?declined=${offer.id}&apikey=${settings.secret.apikey}`);
            global.isTrading = false;
            break;
        case 9:
            // console.log("CreatedNeedsConfirmation");
            break;
        case 10:
            // console.log("CanceledBySecondFactor");
            global.isTrading = false;
            break;
        case 11:
            // console.log("InEscrew");
            global.isTrading = false;
            break;
    }
});

global.eventEmitter.on("sendItem", function (receptorSteamID, itemJson, control_id, msg) {
    manager.loadInventory(730, 2, true, (err, inventory) => {
        if (err) {
            // problema ao resgatar o inventário
            request(settings.botUrl + `?failed=${control_id}&apikey=${settings.secret.apikey}`);
            log.msg("error", `[ERROR 1] Failed to send offer #${control_id}: ${err}`);
            global.isTrading = false;
        } else {
            // cria a oferta pro usuário em questão
            if (itemJson.tradeoffertoken == undefined) {
                log.msg("error", `[ERROR 1] Invalid token #${control_id}: ${err}`);
                global.isTrading = false;
                return false;
            }

            const offer = manager.createOffer(receptorSteamID, itemJson.tradeoffertoken);
            // adiciona um item à proposta

            itemJson.givecsgoitems.forEach(function (e) {
                offer.addMyItem({
                    "id": e,
                    "contextid": 2,
                    "appid": 730
                });
            })

            offer.setMessage(msg);

            offer.send((err, status) => {
                if (err) {
                    request(settings.botUrl + `?failed=${control_id}&apikey=${settings.secret.apikey}`);
                    log.msg("error", `[ERROR 2] Failed to send offer #${control_id}: ${err}`);
                    global.isTrading = false;
                } else {
                    log.msg("info", `Sent offer #${offer.id}. Status: ${status}.`);
                    if (status == 'pending') {
                        // We need to confirm it
                        log.msg("info", `Offer #${offer.id} sent, but requires confirmation`);
                        community.acceptConfirmationForObject(settings.secret.identity, offer.id, function (err) {
                            if (err) {
                                // erro ao tentar confirmar a proposta de troca.
                                request(settings.botUrl + `?failed=${control_id}&apikey=${settings.secret.apikey}`);
                                log.msg("error", `[ERROR 3] Failed to send offer #${control_id}`);
                                global.isTrading = false;
                            } else {
                                // confirmou a oferta no mobile
                                // proposta enviada com sucesso.
                                request(settings.botUrl + `?complete=${control_id}&apikey=${settings.secret.apikey}&tradeofferid=${offer.id}`);
                                log.msg("success", `Offer[${offer.id}] confirmed. Sent successfully.`);
                            }
                        });
                    } else {
                        // proposta enviada com sucesso.
                        request(settings.botUrl + `?complete=${control_id}&apikey=${settings.secret.apikey}&tradeofferid=${offer.id}`);
                        log.msg("success", `Offer[${offer.id}] confirmed. Sent successfully.`);
                    }
                }
            });
        }
    });

});

function acceptNow(offer) {
    log.msg("info", `Trying to accept admin trade.`);
    community.acceptConfirmationForObject(settings.secret.identity, offer.id, function (err) {
        log.msg("success", `Accepted admin trade offer #${offer.id}`);
        clearInterval(acceptFromAdm);
    });
}

manager.on('newOffer', offer => {
    steamid64 = offer.partner.getSteamID64();

    if (settings.admins.indexOf(steamid64) > -1) {

        log.msg("info", `Admin wants to trade`);
        log.msg("info", `Admin taking ${offer.itemsToGive.length} items and giving ${offer.itemsToReceive.length} items`);

        offer.accept(true, (err, status) => {
            if (err) {
                log.msg("error", `Failed to accept admin offer`);
            } else {
                log.msg("success", `Admin sent trade. Waiting for confirmation`);
                acceptFromAdm = setInterval(acceptNow, 5000, offer);
                acceptNow(offer);

            }
        });
    } else {
        if (offer.itemsToReceive.length > 0 && offer.itemsToGive.length == 0 && settings.acceptDonation) {
            offer.accept(true, (err, status) => {
                if (err) {
                    log.msg("error", ` Failed to accept offer`);
                } else {
                    log.msg("info", `${offer.partner.getSteamID64()} sent trade`);
                    acceptFromAdm = setInterval(acceptNow, 5000, offer);
                    acceptNow(offer);
                }
            });
        } else {
            offer.decline(err => {
                if (err) {
                    log.msg("error", ` Failed to decline offer`);
                } else {
                    log.msg("info", `Donation declined`);
                }
            });
        }
    }
});

