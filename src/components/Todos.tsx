import { booleanToSqliteBoolean, sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { type FC, useState } from "react";
import { formatTypeError } from "../lib/helpers";
import { type TodosRow, todosQuery, useEvolu } from "../lib/local-first";

export const Todos: FC = () => {
	// useQuery returns live data - component re-renders when data changes.
	const todos = useQuery(todosQuery);
	const { insert } = useEvolu();
	const [newTodoTitle, setNewTodoTitle] = useState("");

	const addTodo = () => {
		const result = insert(
			"todo",
			{ title: newTodoTitle.trim() },
			{
				onComplete: () => {
					setNewTodoTitle("");
				},
			},
		);

		if (!result.ok) {
			alert(formatTypeError(result.error));
		}
	};

	return (
		<div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
			<ol className="mb-6 space-y-2">
				{todos.map((todo) => (
					<TodoItem key={todo.id} row={todo} />
				))}
			</ol>

			<div className="flex gap-2">
				<input
					type="text"
					value={newTodoTitle}
					onChange={(e) => {
						setNewTodoTitle(e.target.value);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") addTodo();
					}}
					placeholder="Add a new todo..."
					className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
				/>
				<button
					type="button"
					onClick={addTodo}
					className="btn btn-soft btn-primary"
				>
					Add
				</button>
			</div>
		</div>
	);
};

const TodoItem: FC<{
	row: TodosRow;
}> = ({ row: { id, title, isCompleted } }) => {
	const { update } = useEvolu();

	const handleToggleCompletedClick = () => {
		update("todo", {
			id,
			isCompleted: booleanToSqliteBoolean(!isCompleted),
		});
	};

	const handleRenameClick = () => {
		const newTitle = window.prompt("Edit todo", title);
		if (newTitle == null) return;

		const result = update("todo", { id, title: newTitle });
		if (!result.ok) {
			alert(formatTypeError(result.error));
		}
	};

	const handleDeleteClick = () => {
		update("todo", {
			id,
			// Soft delete with isDeleted flag (CRDT-friendly, preserves sync history).
			isDeleted: sqliteTrue,
		});
	};

	return (
		<li className="-mx-2 flex items-center gap-3 px-2 py-2 hover:bg-gray-50">
			<label className="flex flex-1 cursor-pointer items-center gap-3">
				<input
					type="checkbox"
					checked={!!isCompleted}
					onChange={handleToggleCompletedClick}
					className="col-start-1 row-start-1 appearance-none rounded-sm border border-gray-300 bg-white checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:border-gray-300 disabled:bg-gray-100 disabled:checked:bg-gray-100 forced-colors:appearance-auto"
				/>
				<span
					className={`flex-1 text-sm ${
						isCompleted ? "text-gray-500 line-through" : "text-gray-900"
					}`}
				>
					{title}
				</span>
			</label>
			<div className="flex gap-1">
				<button
					type="button"
					onClick={handleRenameClick}
					className="p-1 text-gray-400 transition-colors hover:text-blue-600"
					title="Edit"
				>
					<i className="ph-bold ph-pencil-simple-line" />
				</button>
				<button
					type="button"
					onClick={handleDeleteClick}
					className="p-1 text-gray-400 transition-colors hover:text-red-600"
					title="Delete"
				>
					<i className="ph-bold ph-backspace" />
				</button>
			</div>
		</li>
	);
};
