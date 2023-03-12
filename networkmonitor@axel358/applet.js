const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Lang = imports.lang;
const St = imports.gi.St;
const MessageTray = imports.ui.messageTray;
const GTop = imports.gi.GTop;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;

class NetworkUsageApplet extends Applet.TextApplet {

    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this._source = null;
        this._notification = null;
        this.settings = new Settings.AppletSettings(this, "networkmonitor@axel358", instance_id);

        this.settings.bind("refresh-interval", "refresh_interval", this.on_settings_changed);
        this.settings.bind("decimal-places", "decimal_places", this.on_settings_changed);
        this.settings.bind("hide-umbral", "hide_umbral", this.on_settings_changed);

        this.netload = new GTop.glibtop_netload();

        try {
            let list = new GTop.glibtop_netlist();
            this.devices = GTop.glibtop.get_netlist(list).filter(device => device !== "lo");
        } catch(e) {
            this._notify(e + "")
            global.logError(e + "")
            this.devices = GTop.glibtop.get_netlist(new GTop.glibtop_netlist()).filter(device => device !== "lo");
        }

        this.update();
    }

    on_settings_changed() {
        this.update();
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

        //Get current up and down speed in bytes
        let down_speed = (down - this.last_down) * 1000 / this.refresh_interval
        let up_speed = (up - this.last_up) * 1000 / this.refresh_interval
        let total_speed = down_speed + up_speed

        //Update last up and down
        this.last_down = down
        this.last_up = up

        if(total_speed > this.hide_umbral)
            this.set_applet_label("\u21f5 " + this.formatBytes(total_speed, this.decimal_places) + "/s");
        else
             this.set_applet_label("\u21f5 ")

        this.update_loop_id = Mainloop.timeout_add(this.refresh_interval, Lang.bind(this, this.update));
    }

    formatBytes(bytes, decimals = 1) {
        if (!+bytes) return '0 b'

        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ['b', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

        const i = Math.floor(Math.log(bytes) / Math.log(k))

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }

    on_applet_removed_from_panel() {
        if (this.update_loop_id > 0) {
            Mainloop.source_remove(this.update_loop_id);
            this.update_loop_id = 0;
        }
    }

    _ensure_source() {
        if (!this._source) {
            this._source = new MessageTray.Source("Cinnamon Network Usage");
            this._source.connect('destroy', Lang.bind(this, function () {
                this._source = null;
            }));
            if (Main.messageTray) Main.messageTray.add(this._source);
        }
    }

    _notify(title = "Cinnamon Network Usage", text) {
        if (this._notification)
            this._notification.destroy();

        this._ensure_source();

        let icon = new St.Icon({
            icon_name: "network-transmit-receive-symbolic",
            icon_type: St.IconType.SYMBOLIC,
            icon_size: this._source.ICON_SIZE
        });
        this._notification = new MessageTray.Notification(this._source, title, text,
            { icon: icon });
        this._notification.setTransient(true);
        this._notification.connect('destroy', function () {
            this._notification = null;
        });
        this._source.notify(this._notification);
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new NetworkUsageApplet(metadata, orientation, panel_height, instance_id);
}
