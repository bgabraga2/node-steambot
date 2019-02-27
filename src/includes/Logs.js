


class Logs{
    constructor(settings){
        this.botName = settings.botDisplayName;
        this.colors = require('colors');
    }
    formatDate(date) {
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 24;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0'+minutes : minutes;
        var strTime = hours + ':' + minutes;
        return date.getMonth()+1 + "/" + date.getDate() + "/" + date.getFullYear() + " " + strTime;
    }
    msg(type,msg){
        this.colors.setTheme({
            error: ['red', 'bold'],
            info: ['yellow', 'bold'],
            success: ['green', 'bold'],
            normal: ['white', 'bold']
        });
        var datenow = this.formatDate(new Date());
        switch(type){
            case "normal":
                console.log(`${this.botName} - ${datenow}: ${msg}`.normal);
            break;
            case "error":
                console.log(`${this.botName} - ${datenow}: ${msg}`.error);
            break;
            case "info":
                console.log(`${this.botName} - ${datenow}: ${msg}`.info);
            break;
            case "success":
                console.log(`${this.botName} - ${datenow}: ${msg}`.success);
            break;
        } 
    }
}
module.exports = Logs

 