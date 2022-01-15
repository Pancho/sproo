export default class Http {
	[Symbol.toStringTag] = 'Http';
	static STANDARD_HEADERS = {
		'Accept': 'application/json, text/plain, */*',
		'X-Requested-With': 'XMLHttpRequest',
	};
	static instance;
	httpEndpointStub;

	constructor(httpEndpointStub, authentication) {
		if (Http.instance) {
			throw new Error('Only one instance of Http allowed');
		}

		if (typeof httpEndpointStub === 'undefined') {
			throw new Error(`You cannot have a Http instance without providing a stub
			(stem, first part, http://www.example.com/api/v1/or/something) from which we build the rest of the URL to hit`);
		}
		if (!httpEndpointStub) {
			httpEndpointStub = '';
		}

		Http.instance = this;

		const cleanedStub = httpEndpointStub.endsWith('/') ? httpEndpointStub.slice(0, -1) : httpEndpointStub;
		this.httpEndpointStub = `${window.location.protocol}//${window.location.host}${cleanedStub}`;
		this.authentication = authentication;
	}

	constructUrl(path, params) {
		const localPath = path.startsWith('/') ? path.slice(1) : path;
		let queryString = '';

		if (params) {
			queryString = Object.entries(params).map((entry) => `${ entry[0] }=${ ''.join(entry[1]) }`).join('&');
		}

		if (queryString.length > 0) {
			return `${ this.httpEndpointStub }/${ localPath }?${ queryString }`;
		}

		return `${ this.httpEndpointStub }/${ localPath }`;
	}

	// MDN: The GET method requests a representation of the specified resource. Requests using GET should only retrieve data.
	async get(path, params, httpHeaders, authenticate = true) {
		const headers = {
				...Http.STANDARD_HEADERS,
				...httpHeaders,
			},
			options = {
				method: 'GET',
				headers: headers,
			},
			url = this.constructUrl(path, params);

		return await this.fetch(url, options, authenticate);
	}

	// MDN: The HEAD method asks for a response identical to that of a GET request, but without the response body.
	async head(path, params, httpHeaders, authenticate = true) {
		const headers = {
				...Http.STANDARD_HEADERS,
				...httpHeaders,
			},
			options = {
				method: 'HEAD',
				headers: headers,
			},
			url = this.constructUrl(path, params);

		return await this.fetch(url, options, authenticate);
	}

	// MDN: The DELETE method deletes the specified resource.
	async delete(path, params, httpHeaders, authenticate = true) {
		const headers = {
				...Http.STANDARD_HEADERS,
				...httpHeaders,
			},
			options = {
				method: 'DELETE',
				headers: headers,
			},
			url = this.constructUrl(path, params);

		return await this.fetch(url, options, authenticate);
	}

	// MDN: The OPTIONS method is used to describe the communication options for the target resource.
	async options(path, params, httpHeaders, authenticate = true) {
		const headers = {
				...Http.STANDARD_HEADERS,
				...httpHeaders,
			},
			options = {
				method: 'OPTIONS',
				headers: headers,
			},
			url = this.constructUrl(path, params);

		return await this.fetch(url, options, authenticate);
	}

	/* MDN: The POST method is used to submit an entity to the specified resource, often causing a change in state or side effects on the
	* server.
	*/
	async post(path, body, fetchOptions, httpHeaders, authenticate = true) {
		const headers = {
				...Http.STANDARD_HEADERS,
				...httpHeaders,
			},
			options = {
				method: 'POST',
				headers: headers,
				body: body,
				...fetchOptions,
			},
			url = this.constructUrl(path);

		return await this.fetch(url, options, authenticate);
	}

	// MDN: The PUT method replaces all current representations of the target resource with the request payload.
	async put(path, body, fetchOptions, httpHeaders, authenticate = true) {
		const headers = {
				...Http.STANDARD_HEADERS,
				...httpHeaders,
			},
			options = {
				method: 'PUT',
				headers: headers,
				body: body,
				...fetchOptions,
			},
			url = this.constructUrl(path);

		return await this.fetch(url, options, authenticate);
	}

	async fetch(url, options, authenticate) {
		if (authenticate) {
			return await window.fetch(url, this.authentication.addAuthentication(options));
		}

		return await window.fetch(url, options);
	}
}
