import { useState } from "react"
import "./App.css"
import Item from "./Item.jsx"
import Search from "./Search.jsx"

const App = () => {
	const [result, setResult] = useState({
		items: [],
		loading: false,
		message: null,
	})

	const onChange = (value) => {
		if (value.error) {
			setResult({ items: [], loading: false, message: value.error })
		} else if (value.ready) {
			setResult({ items: [], loading: false, message: null })
		} else {
			setResult(value)
		}
	}

	return (
		<div className="component-root component-app">
			<Search onChange={onChange} />
			{result.message
				? <div className="message">{result.message}</div>
				: (
					<div>
						<ul>
							{result.items.map(item => (
								<li key={item.gist_id + item.filename}>
									<Item item={item} />
								</li>
							))}
						</ul>
						{result.loading && <div className="loader" />}
					</div>
				)}
		</div>
	)
}

export default App
