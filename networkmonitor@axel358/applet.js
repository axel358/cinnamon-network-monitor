const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Lang = imports.lang;
const St = imports.gi.St;
const GTop = imports.gi.GTop;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;
const Tooltips = imports.ui.tooltips;

class NetworkUsageApplet extends Applet.TextApplet {

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.settings = new Settings.AppletSettings(this, "networkmonitor@axel358", instance_id);

        this.settings.bind("refresh-interval", "refresh_interval", this.on_settings_changed);
        this.settings.bind("decimal-places", "decimal_places", this.on_settings_changed);
        this.settings.bind("hide-umbral", "hide_umbral", this.on_settings_changed);
        this.settings.bind("display-style", "display_style", this.on_settings_changed);

        this._applet_tooltip._tooltip.set_style("text-align:left");

        this.netload = new GTop.glibtop_netload();

        //Hack: this fails the first time it's called during Cinnamon startup
        try {
            this.devices = GTop.glibtop.get_netlist(new GTop.glibtop_netlist()).filter(device => device !== "lo");
        } catch(e) {
            global.logError(e + "")
            this.devices = GTop.glibtop.get_netlist(new GTop.glibtop_netlist()).filter(device => device !== "lo");
        }

        this.update();
    }

    on_settings_changed() {
        //TODO: This causes performance issues
        //this.update();
    }

    update() {
        //Gather network traffic on all devices
        let down = 0;
        let up = 0;

        for (let i = 0; i < this.devices.length; ++i)
        {
            GTop.glibtop.get_netload(this.netload, this.devices[i]);
            down += this.netload.bytes_in;
            up += this.netload.bytes_out;
        }

        this.set_applet_tooltip("Downloaded: " + this.formatBytes(down) + "\nUploaded: " + this.formatBytes(up))

        //Get current up and down speed in bytes per second
        let down_speed = (down - this.last_down) / this.refresh_interval * 1000;
        let up_speed = (up - this.last_up) / this.refresh_interval * 1000;
        let total_speed = down_speed + up_speed;

        //Update last up and down
        this.last_down = down;
        this.last_up = up;

        if(total_speed >= this.hide_umbral) {
            switch(this.display_style){
                case "combined":
                    this.set_applet_label("\u21f5 " + this.formatBytes(total_speed, this.decimal_places) + "/s");
                    break;
                case "column":
                    this.set_applet_label("\u2191 " + this.formatBytes(up_speed, this.decimal_places) + "/s\n\u2193 " + this.formatBytes(down_speed, this.decimal_places) + "/s");
                    break;
                case "both":
                    this.set_applet_label("\u2191 " + this.formatBytes(up_speed, this.decimal_places) + "/s \u2193" + this.formatBytes(down_speed, this.decimal_places) + "/s");
                    break;
                case "download":
                    this.set_applet_label("\u2193 " + this.formatBytes(down_speed, this.decimal_places) + "/s");
                    break;
                case "upload":
                    this.set_applet_label("\u2191 " + this.formatBytes(up_speed, this.decimal_places) + "/s");
            }
        }
        else
             this.set_applet_label("\u21f5");

        this.update_loop_id = Mainloop.timeout_add(this.refresh_interval, Lang.bind(this, this.update));
    }

    formatBytes(bytes, decimals = 1) {
        if (!+bytes)
            return '0 b';

        const sizes = ['b', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));

        return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(decimals))} ${sizes[i]}`;
    }

    on_applet_removed_from_panel() {
        if (this.update_loop_id > 0) {
            Mainloop.source_remove(this.update_loop_id);
            this.update_loop_id = 0;
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new NetworkUsageApplet(metadata, orientation, panel_height, instance_id);
}
