import { extend } from "alcalzone-shared/objects";
import { SortedList } from "alcalzone-shared/sorted-list";
import { Global as _ } from "./global";

interface ExpireTimestamp {
	timestamp: number;
	id: string;
}

export class ObjectCache {

	/**
	 * @param expiryDuration The timespan after which cached objects are expired automatically
	 */
	constructor(private expiryDuration: number | false = false) { }

	private cache = new Map<string, ioBroker.Object>();
	private expireTimestamps = new SortedList<ExpireTimestamp>();
	private expireTimer: NodeJS.Timer;

	/**
	 * Retrieves an object from the cache or queries the database if it is not cached yet
	 * @param id The id of the object to retrieve
	 */
	public async getObject(id: string): Promise<ioBroker.Object> {
		if (!this.cache.has(id)) {
			// retrieve the original object from the DB
			const ret = await _.adapter.$getForeignObject(id);
			// and remember it in the cache
			if (ret != null) this.storeObject(ret);
		}
		return this.retrieveObject(id);
	}

	private storeObject(obj: ioBroker.Object) {
		const clone = extend({}, obj) as ioBroker.Object;
		this.cache.set(clone._id, clone);
		this.rememberForExpiry(clone._id);
	}

	private retrieveObject(id: string): ioBroker.Object {
		if (this.cache.has(id)) {
			return extend({}, this.cache.get(id)) as ioBroker.Object;
		}
	}

	private rememberForExpiry(id: string) {
		if (typeof this.expiryDuration !== "number") return;

		const existingTimestamp = [...this.expireTimestamps].find(ets => ets.id === id);
		if (existingTimestamp != null) {
			this.expireTimestamps.remove(existingTimestamp);
		}
		const newTimestamp: ExpireTimestamp = {
			timestamp: Date.now() + this.expiryDuration,
			id,
		};
		this.expireTimestamps.add(newTimestamp);
		// if no expiry timer is running, start one
		if (this.expireTimer == null) {
			this.expireTimer = setTimeout(() => this.expire(), this.expiryDuration);
		}
	}

	private expire() {
		this.expireTimer = null;
		if (this.expireTimestamps.length === 0) return;

		const nextTimestamp = this.expireTimestamps.shift();
		const timeDelta = nextTimestamp.timestamp - Date.now();
		if (timeDelta <= 0) {
			// it has expired
			this.invalidateObject(nextTimestamp.id);
		} else {
			// it hasn't, so re-add it
			// TODO: We need a peek method in the sorted list
			this.expireTimestamps.add(nextTimestamp);
		}
		this.setTimerForNextExpiry();
	}

	private setTimerForNextExpiry() {
		if (this.expireTimestamps.length === 0) return;

		// workaround for missing peek();
		const nextTimestamp = this.expireTimestamps.shift();
		this.expireTimestamps.add(nextTimestamp);

		const timeDelta = nextTimestamp.timestamp - Date.now();
		this.expireTimer = setTimeout(
			() => this.expire(),
			Math.max(timeDelta, 100),
		);
}

	/**
	 * Causes the cache for an object to be invalidated
	 * @param id The id of the object to invalidate
	 */
	public invalidateObject(id: string) {
		this.cache.delete(id);
	}

	/**
	 * Updates an object in the cache
	 * @param id The id of the object to update
	 * @param obj The updated object
	 */
	public updateObject(obj: ioBroker.Object) {
		this.storeObject(obj);
	}

	public dispose() {
		if (this.expireTimer != null) {
			clearTimeout(this.expireTimer);
			this.expireTimer = null;
		}
		this.cache.clear();
	}
}
