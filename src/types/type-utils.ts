import {
    $mobx,
    IDepTreeNode,
    fail,
    isAtom,
    isComputedValue,
    isObservableArray,
    isObservableMap,
    isObservableObject,
    isReaction,
    isObservableSet,
    IAtom,
    isPrimitiveValue,
    createAtom,
    stringifyKey
} from "../internal"

export function getAtom(thing: any, property?: string): IDepTreeNode {
    if (typeof thing === "object" && thing !== null) {
        if (isObservableArray(thing)) {
            if (property !== undefined)
                fail(__DEV__ && "It is not possible to get index atoms from arrays")
            return (thing as any)[$mobx].atom
        }
        if (isObservableSet(thing)) {
            return (thing as any)[$mobx]
        }
        if (isObservableMap(thing)) {
            const anyThing = thing as any
            if (property === undefined) return anyThing._keysAtom
            const observable = anyThing._data.get(property) || anyThing._hasMap.get(property)
            if (!observable)
                fail(
                    __DEV__ &&
                        `the entry '${property}' does not exist in the observable map '${getDebugName(
                            thing
                        )}'`
                )
            return observable
        }
        if (property && !thing[$mobx]) thing[property] // See #1072
        if (isObservableObject(thing)) {
            if (!property) return fail(__DEV__ && `please specify a property`)
            const observable = (thing as any)[$mobx].values.get(property)
            if (!observable)
                fail(
                    __DEV__ &&
                        `no observable property '${property.toString()}' found on the observable object '${getDebugName(
                            thing
                        )}'`
                )
            return observable
        }
        if (isAtom(thing) || isComputedValue(thing) || isReaction(thing)) {
            return thing
        }
    } else if (typeof thing === "function") {
        if (isReaction(thing[$mobx])) {
            // disposer function
            return thing[$mobx]
        }
    }
    return fail(__DEV__ && "Cannot obtain atom from " + thing)
}

export function getAdministration(thing: any, property?: string) {
    if (!thing) fail("Expecting some object")
    if (property !== undefined) return getAdministration(getAtom(thing, property))
    if (isAtom(thing) || isComputedValue(thing) || isReaction(thing)) return thing
    if (isObservableMap(thing) || isObservableSet(thing)) return thing
    if (thing[$mobx]) return thing[$mobx]
    fail(__DEV__ && "Cannot obtain administration from " + thing)
}

export function getDebugName(thing: any, property?: string): string {
    let named
    if (property !== undefined) named = getAtom(thing, property)
    else if (isObservableObject(thing) || isObservableMap(thing) || isObservableSet(thing))
        named = getAdministration(thing)
    else named = getAtom(thing) // valid for arrays as well
    return named.name
}

export class HasMap {
    private _map: Map<any, IAtom> | undefined
    private _weakMap: WeakMap<object, IAtom> | undefined

    constructor(private _namePrefix: string) {}

    has(key: any): boolean {
        return !!this.get(key)
    }

    get(key: any): IAtom | undefined {
        return isPrimitiveValue(key) ? this._map?.get(key) : this._weakMap?.get(key)
    }

    reportObserved(key: any): void {
        let entry: IAtom | undefined = this.get(key)

        if (!entry) {
            const name = `${this._namePrefix}.${stringifyKey(key)}?`
            if (isPrimitiveValue(key)) {
                if (!this._map) {
                    this._map = new Map()
                }

                entry = createAtom(name, undefined, () => this._map?.delete(key))

                this._map.set(key, entry)
            } else {
                if (!this._weakMap) {
                    this._weakMap = new WeakMap()
                }

                entry = createAtom(name)

                this._weakMap.set(key, entry)
            }
        }

        entry.reportObserved()
    }

    reportChanged(key: any): void {
        return this.get(key)?.reportChanged()
    }
}
